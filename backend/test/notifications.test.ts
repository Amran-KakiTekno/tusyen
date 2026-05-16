import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeNtfyTopic,
  ntfyHealth,
  ntfyPublicTopicUrl,
  ntfySmokeTopic,
  ntfyTopicForClassroom,
  publishNtfyNotification,
} from '../src/notifications';

describe('ntfy notifications', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response('{"id":"message-1"}', { status: 200 })) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('normalizes deterministic topics for classroom and smoke notifications', () => {
    expect(normalizeNtfyTopic('Tusyen Classroom !! 123')).toBe('Tusyen_Classroom_123');
    expect(ntfyTopicForClassroom('11111111-1111-4111-8111-111111111111'))
      .toBe('tusyen_classroom_11111111-1111-4111-8111-111111111111');
    expect(ntfySmokeTopic()).toBe('tusyen_smoke');
    expect(ntfyPublicTopicUrl('demo topic')).toBe('http://localhost:2586/demo_topic');
  });

  it('publishes messages with ntfy headers and timeout-safe fetch', async () => {
    const result = await publishNtfyNotification({
      topic: 'classroom-1',
      title: 'New post',
      message: 'A new teacher post is ready.',
      priority: 'high',
      tags: ['memo', 'science'],
      clickPath: '/quiz/join',
    });

    expect(result).toMatchObject({ ok: true, topic: 'classroom-1', statusCode: 200 });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:2586/classroom-1',
      expect.objectContaining({
        method: 'POST',
        body: 'A new teacher post is ready.',
        headers: expect.objectContaining({
          Title: 'New post',
          Priority: '4',
          Tags: 'memo,science',
        }),
      }),
    );
  });

  it('reports ntfy health status', async () => {
    const health = await ntfyHealth();

    expect(health).toMatchObject({
      enabled: true,
      connected: true,
      statusCode: 200,
      url: 'http://localhost:2586',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:2586/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
