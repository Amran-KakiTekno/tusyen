import type { FastifyRequest } from 'fastify';

export function auditLog(
  request: FastifyRequest,
  event: string,
  metadata: Record<string, unknown> = {},
) {
  const user = (request as any).user || {};
  request.log.info({
    audit: true,
    event,
    userId: user.userId || user.id || null,
    role: user.role || null,
    ip: clientIp(request),
    timestamp: new Date().toISOString(),
    ...metadata,
  }, 'audit event');
}

function clientIp(request: FastifyRequest) {
  const headers = request.headers as Record<string, string | string[] | undefined>;
  const forwardedFor = firstHeader(headers['x-forwarded-for']);
  const cfConnectingIp = firstHeader(headers['cf-connecting-ip']);
  return (cfConnectingIp || forwardedFor?.split(',')[0]?.trim() || request.ip || 'unknown')
    .replace(/[^a-zA-Z0-9:._-]/g, '_')
    .slice(0, 80);
}

function firstHeader(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}
