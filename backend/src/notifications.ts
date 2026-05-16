import { FastifyInstance } from 'fastify';
import { db } from './database';
import { config } from './config';

type NotificationPriority = 'min' | 'low' | 'default' | 'high' | 'urgent';

type NotificationPublishInput = {
  topic: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  tags?: string[];
  clickPath?: string;
  actions?: string;
};

type PublishResult = {
  ok: boolean;
  skipped?: boolean;
  topic: string;
  statusCode?: number;
  error?: string;
};

const PRIORITY_VALUE: Record<NotificationPriority, string> = {
  min: '1',
  low: '2',
  default: '3',
  high: '4',
  urgent: '5',
};

export function ntfyTopicForClassroom(classroomId: string) {
  return normalizeNtfyTopic(`${config.NTFY_TOPIC_PREFIX}_classroom_${classroomId}`);
}

export function ntfySmokeTopic() {
  return normalizeNtfyTopic(`${config.NTFY_TOPIC_PREFIX}_smoke`);
}

export function ntfyPublicTopicUrl(topic: string) {
  return joinUrl(config.NTFY_PUBLIC_URL, `/${normalizeNtfyTopic(topic)}`);
}

export function normalizeNtfyTopic(value: string) {
  const topic = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

  if (!topic) return 'tusyen_notifications';
  return topic;
}

export async function ntfyHealth() {
  if (!config.NTFY_ENABLED) {
    return {
      enabled: false,
      connected: false,
      url: config.NTFY_URL,
      publicUrl: config.NTFY_PUBLIC_URL,
    };
  }

  try {
    const response = await fetchWithTimeout(joinUrl(config.NTFY_URL, '/v1/health'), {
      method: 'GET',
      headers: authHeaders(),
    });

    return {
      enabled: true,
      connected: response.ok,
      statusCode: response.status,
      url: config.NTFY_URL,
      publicUrl: config.NTFY_PUBLIC_URL,
    };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      error: errorMessage(error),
      url: config.NTFY_URL,
      publicUrl: config.NTFY_PUBLIC_URL,
    };
  }
}

export async function publishNtfyNotification(input: NotificationPublishInput): Promise<PublishResult> {
  const topic = normalizeNtfyTopic(input.topic);
  if (!config.NTFY_ENABLED) {
    return { ok: false, skipped: true, topic };
  }

  const headers: Record<string, string> = {
    ...authHeaders(),
    Title: sanitizeHeader(input.title).slice(0, 120),
    Priority: PRIORITY_VALUE[input.priority || 'default'],
  };

  if (input.tags?.length) {
    headers.Tags = input.tags.map(sanitizeTag).filter(Boolean).slice(0, 6).join(',');
  }

  const click = notificationClickUrl(input.clickPath);
  if (click) headers.Click = click;
  if (input.actions) headers.Actions = input.actions;

  const response = await fetchWithTimeout(joinUrl(config.NTFY_URL, `/${topic}`), {
    method: 'POST',
    headers,
    body: input.message.slice(0, 4000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`ntfy publish failed (${response.status}): ${body.slice(0, 300)}`);
  }

  return {
    ok: true,
    topic,
    statusCode: response.status,
  };
}

export async function publishClassroomPostNotification(fastify: FastifyInstance, input: {
  classroomId: string;
  postId: string;
  title?: string | null;
  content?: string | null;
}) {
  return safePublish(fastify, async () => {
    const context = await loadClassroomContext(input.classroomId);
    return publishNtfyNotification({
      topic: ntfyTopicForClassroom(input.classroomId),
      title: `${context?.name || 'Classroom'}: new post`,
      message: compactMessage(input.title || input.content || 'A teacher posted a new classroom update.'),
      tags: ['memo', context?.subject || 'classroom'],
      priority: 'default',
      clickPath: '/',
    });
  });
}

export async function publishLessonAssignedNotification(fastify: FastifyInstance, input: {
  classroomId: string;
  lessonId: string;
  dueDate?: string | null;
}) {
  return safePublish(fastify, async () => {
    const context = await loadClassroomContext(input.classroomId);
    const lesson = await loadLessonContext(input.lessonId);
    const dueText = input.dueDate ? ` Due ${formatShortDate(input.dueDate)}.` : '';
    return publishNtfyNotification({
      topic: ntfyTopicForClassroom(input.classroomId),
      title: `${context?.name || 'Classroom'}: lesson assigned`,
      message: compactMessage(`${lesson?.title || 'A new lesson'} is ready.${dueText}`),
      tags: ['books', lesson?.subject || context?.subject || 'lesson'],
      priority: 'high',
      clickPath: '/',
    });
  });
}

export async function publishQuizSessionNotification(fastify: FastifyInstance, input: {
  classroomId: string;
  classroomName?: string | null;
  deckTitle?: string | null;
  pin?: string | null;
  status: 'lobby' | 'started';
}) {
  return safePublish(fastify, async () => {
    const context = input.classroomName ? null : await loadClassroomContext(input.classroomId);
    const classroomName = input.classroomName || context?.name || 'Classroom';
    const pinText = input.pin ? ` PIN ${input.pin}.` : '';
    return publishNtfyNotification({
      topic: ntfyTopicForClassroom(input.classroomId),
      title: input.status === 'started' ? `${classroomName}: quiz started` : `${classroomName}: quiz room open`,
      message: compactMessage(`${input.deckTitle || 'Live quiz'} ${input.status === 'started' ? 'has started.' : 'is open.'}${pinText}`),
      tags: ['game_die', 'quiz'],
      priority: 'high',
      clickPath: '/quiz/join',
    });
  });
}

export async function publishWhiteboardStartedNotification(fastify: FastifyInstance, input: {
  classroomId: string;
  sessionId: string;
  title?: string | null;
}) {
  return safePublish(fastify, async () => {
    const context = await loadClassroomContext(input.classroomId);
    return publishNtfyNotification({
      topic: ntfyTopicForClassroom(input.classroomId),
      title: `${context?.name || 'Classroom'}: whiteboard live`,
      message: compactMessage(input.title || 'A live whiteboard session has started.'),
      tags: ['writing_hand', 'whiteboard'],
      priority: 'high',
      clickPath: '/',
    });
  });
}

async function safePublish(fastify: FastifyInstance, publish: () => Promise<PublishResult>) {
  try {
    return await publish();
  } catch (error) {
    fastify.log.warn({ err: error }, 'Notification publish failed');
    return {
      ok: false,
      topic: '',
      error: errorMessage(error),
    };
  }
}

async function loadClassroomContext(classroomId: string): Promise<{ name: string; subject: string } | null> {
  const result = await db.query(
    'SELECT name, subject FROM classrooms WHERE id = $1 LIMIT 1',
    [classroomId],
  );
  return result.rows[0] || null;
}

async function loadLessonContext(lessonId: string): Promise<{ title: string; subject: string } | null> {
  const result = await db.query(
    'SELECT title, subject FROM lessons WHERE id = $1 LIMIT 1',
    [lessonId],
  );
  return result.rows[0] || null;
}

function notificationClickUrl(path?: string) {
  const base = config.PUBLIC_APP_URL || '';
  if (!base || !path) return '';

  try {
    return new URL(path, base).toString();
  } catch {
    return '';
  }
}

function authHeaders(): Record<string, string> {
  if (config.NTFY_ACCESS_TOKEN) {
    return { Authorization: `Bearer ${config.NTFY_ACCESS_TOKEN}` };
  }

  if (config.NTFY_USERNAME && config.NTFY_PASSWORD) {
    return {
      Authorization: `Basic ${Buffer.from(`${config.NTFY_USERNAME}:${config.NTFY_PASSWORD}`).toString('base64')}`,
    };
  }

  return {};
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.NTFY_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]/g, ' ').trim();
}

function sanitizeTag(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

function compactMessage(value: string) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text || 'New Tusyen classroom activity.';
}

function formatShortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-MY', {
    month: 'short',
    day: 'numeric',
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Notification request failed';
}
