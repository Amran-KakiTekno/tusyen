import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => vi.fn());
const publishMock = vi.hoisted(() => vi.fn());

vi.mock('../src/database', () => ({
  db: {
    query: queryMock,
  },
}));

vi.mock('../src/redis', () => ({
  redis: {
    publish: publishMock,
  },
  getClassroomPresence: vi.fn().mockResolvedValue([]),
  setUserPresence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/config', () => ({
  config: {
    CENTRIFUGO_SECRET: 'test-centrifugo-secret',
    MINIO_BUCKET_WHITEBOARD: 'eduapp-whiteboard',
  },
}));

const { whiteboardRoutes } = await import('../src/whiteboard/routes');

const teacher = { userId: 'teacher-1', role: 'teacher' as const };
const admin = { userId: 'admin-1', role: 'admin' as const };
const classroomId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const fileId = '33333333-3333-4333-8333-333333333333';

function buildApp(user: typeof teacher | typeof admin) {
  const app = Fastify();

  app.decorate('authenticate', async (request: any) => {
    request.user = user;
  });
  app.decorate('jwt', {
    sign: vi.fn(() => 'signed-media-token'),
  });
  app.register(whiteboardRoutes, { prefix: '/whiteboard' });
  return app;
}

describe('whiteboard routes', () => {
  beforeEach(() => {
    queryMock.mockReset();
    publishMock.mockReset();
    publishMock.mockResolvedValue(1);
  });

  it('attaches only owned whiteboard video recordings and returns protected media', async () => {
    const app = buildApp(teacher);
    await app.ready();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ classroom_id: classroomId, teacher_id: teacher.userId, status: 'ended' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: fileId,
          user_id: teacher.userId,
          object_name: 'teacher-1/recording.webm',
          mime_type: 'video/webm;codecs=vp9',
          size_bytes: 4096,
          bucket: 'eduapp-whiteboard',
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: sessionId,
          classroom_id: classroomId,
          teacher_id: teacher.userId,
          title: 'Live revision',
          status: 'ended',
          recording_file_id: fileId,
          recording_name: 'recording.webm',
          recording_mime_type: 'video/webm',
          recording_size_bytes: 4096,
          recording_url: `/api/storage/files/${fileId}/content`,
        }],
      });

    const response = await app.inject({
      method: 'POST',
      url: `/whiteboard/session/${sessionId}/recording`,
      payload: {
        fileId,
        durationSeconds: 34,
        fileSizeBytes: 4096,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(queryMock.mock.calls[2][0]).toContain('recording_file_id');
    expect(queryMock.mock.calls[2][1]).toEqual([
      fileId,
      'teacher-1/recording.webm',
      34,
      4096,
      'video/webm;codecs=vp9',
      sessionId,
    ]);
    expect(response.json().recording.url).toContain('/api/storage/files/');
    expect(publishMock).toHaveBeenCalledWith(
      `classroom:${classroomId}`,
      expect.stringContaining('WHITEBOARD_RECORDING_READY')
    );

    await app.close();
  });

  it('rejects non-video files before updating the session', async () => {
    const app = buildApp(teacher);
    await app.ready();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ classroom_id: classroomId, teacher_id: teacher.userId, status: 'ended' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: fileId,
          user_id: teacher.userId,
          object_name: 'teacher-1/diagram.png',
          mime_type: 'image/png',
          size_bytes: 1024,
          bucket: 'eduapp-whiteboard',
        }],
      });

    const response = await app.inject({
      method: 'POST',
      url: `/whiteboard/session/${sessionId}/recording`,
      payload: { fileId },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('Recording must be');
    expect(queryMock).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it('returns replay events for authorized users', async () => {
    const app = buildApp(admin);
    await app.ready();

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ classroom_id: classroomId }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'event-1',
          session_id: sessionId,
          classroom_id: classroomId,
          user_id: teacher.userId,
          event_type: 'draw',
          payload: { strokes: [{ points: [[0.1, 0.2], [0.3, 0.4]] }] },
          sequence: 1,
        }],
      });

    const response = await app.inject({
      method: 'GET',
      url: `/whiteboard/session/${sessionId}/events`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().events).toHaveLength(1);
    expect(queryMock.mock.calls[1][0]).toContain('whiteboard_events');

    await app.close();
  });
});
