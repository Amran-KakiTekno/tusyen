import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => vi.fn());

vi.mock('../src/database', () => ({
  db: {
    query: queryMock,
  },
}));

const {
  MediaAccessError,
  assertCanAttachMediaReferences,
  canonicalMediaUrl,
  extractMediaFileIdsFromValue,
  protectMediaReferences,
  userCanAccessMediaFile,
} = await import('../src/media-access');

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const fileId = '33333333-3333-4333-8333-333333333333';

describe('media access helpers', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('extracts file ids from modern and legacy media URLs', () => {
    expect(extractMediaFileIdsFromValue({
      attachments: [
        { fileId },
        { url: `/api/storage/public/${fileId}` },
        { url: canonicalMediaUrl(fileId) },
      ],
    })).toEqual([fileId]);
  });

  it('signs protected media references without persisting public URLs', () => {
    const fastify = {
      jwt: {
        sign: vi.fn(() => 'signed-media-token'),
      },
    } as any;

    const protectedValue = protectMediaReferences(fastify, {
      userId: ownerId,
      role: 'student',
    }, {
      fileId,
      url: `/api/storage/public/${fileId}`,
      name: 'diagram.png',
    });

    expect(protectedValue.url).toContain(`/api/storage/files/${fileId}/content?mediaToken=`);
    expect(protectedValue.isProtectedMedia).toBe(true);
    expect(fastify.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'media:read', fileId, userId: ownerId }),
      expect.objectContaining({ expiresIn: 900 })
    );
  });

  it('allows users to attach only their own uploaded media', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: fileId, user_id: ownerId }],
    });

    await expect(assertCanAttachMediaReferences({
      userId: ownerId,
      role: 'student',
    }, [{ fileId }])).resolves.toBeUndefined();

    queryMock.mockResolvedValueOnce({
      rows: [{ id: fileId, user_id: otherUserId }],
    });

    await expect(assertCanAttachMediaReferences({
      userId: ownerId,
      role: 'student',
    }, [{ fileId }])).rejects.toBeInstanceOf(MediaAccessError);
  });

  it('delegates full read authorization to the database policy query', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ allowed: true }] });

    await expect(userCanAccessMediaFile({
      userId: ownerId,
      role: 'parent',
    }, fileId)).resolves.toBe(true);

    expect(queryMock.mock.calls[0][0]).toContain('whiteboard_sessions');
    expect(queryMock.mock.calls[0][0]).toContain('classroom_enrollments');
    expect(queryMock.mock.calls[0][1]).toEqual([fileId, ownerId, 'parent', `%${fileId}%`]);
  });
});
