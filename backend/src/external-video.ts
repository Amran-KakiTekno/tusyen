export type ExternalVideoProvider = 'youtube' | 'vimeo' | 'loom';

export type ExternalVideoInfo = {
  provider: ExternalVideoProvider;
  providerName: string;
  videoId: string;
  originalUrl: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  startSeconds?: number;
};

export class ExternalVideoError extends Error {
  constructor(message = 'Unsupported external video URL') {
    super(message);
  }
}

const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;
const safeIdPattern = /^[A-Za-z0-9_-]+$/;
const vimeoHashPattern = /^[A-Za-z0-9]+$/;

export function externalVideoInfo(rawUrl: unknown): ExternalVideoInfo | null {
  const url = parseExternalUrl(rawUrl);
  if (!url) return null;

  const host = normalizedHost(url);
  if (isYouTubeHost(host)) return youtubeInfo(url, host);
  if (isVimeoHost(host)) return vimeoInfo(url);
  if (isLoomHost(host)) return loomInfo(url);
  return null;
}

export function assertExternalVideoInfo(rawUrl: unknown): ExternalVideoInfo {
  const info = externalVideoInfo(rawUrl);
  if (!info) {
    throw new ExternalVideoError('External video embeds must be YouTube, Vimeo, or Loom links');
  }
  return info;
}

export function normalizeExternalVideoAttachment(input: Record<string, unknown>): Record<string, unknown> {
  const rawUrl = input.url ?? input.embedUrl ?? input.embed_url;
  const info = assertExternalVideoInfo(rawUrl);
  const title = stringOrNull(input.name ?? input.title ?? input.filename) || `${info.providerName} video`;

  return {
    type: 'embed',
    url: info.originalUrl,
    embedUrl: info.embedUrl,
    provider: info.provider,
    providerName: info.providerName,
    providerVideoId: info.videoId,
    thumbnailUrl: info.thumbnailUrl,
    name: title,
    mimeType: 'text/html',
    size: 0,
  };
}

export function normalizeExternalVideoBlock(input: Record<string, unknown>): Record<string, unknown> {
  const info = assertExternalVideoInfo(input.url ?? input.embedUrl ?? input.embed_url);
  return {
    ...input,
    type: 'embed',
    url: info.originalUrl,
    embedUrl: info.embedUrl,
    provider: info.provider,
    providerName: info.providerName,
    providerVideoId: info.videoId,
    thumbnailUrl: info.thumbnailUrl,
  };
}

function parseExternalUrl(rawUrl: unknown): URL | null {
  const text = `${rawUrl ?? ''}`.trim();
  if (!text || text.length > 2048) return null;

  try {
    const url = new URL(text);
    if (url.username || url.password) return null;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.protocol = 'https:';
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function youtubeInfo(url: URL, host: string): ExternalVideoInfo | null {
  let videoId: string | null = null;

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else {
    const segments = url.pathname.split('/').filter(Boolean);
    const first = segments[0] ?? '';
    if (first === 'watch') {
      videoId = url.searchParams.get('v');
    } else if ((first === 'embed' || first === 'shorts' || first === 'live') && segments.length > 1) {
      videoId = segments[1];
    }
  }

  videoId = cleanVideoId(videoId, youtubeIdPattern);
  if (!videoId) return null;

  const startSeconds = youtubeStartSeconds(url);
  const query = new URLSearchParams({ rel: '0' });
  if (startSeconds > 0) query.set('start', `${startSeconds}`);

  const original = new URL('https://www.youtube.com/watch');
  original.searchParams.set('v', videoId);
  if (startSeconds > 0) original.searchParams.set('t', `${startSeconds}s`);

  return {
    provider: 'youtube',
    providerName: 'YouTube',
    videoId,
    originalUrl: original.toString(),
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?${query.toString()}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    startSeconds,
  };
}

function vimeoInfo(url: URL): ExternalVideoInfo | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const videoId = segments.find((segment) => /^\d+$/.test(segment));
  if (!videoId) return null;

  const hashFromQuery = stringOrNull(url.searchParams.get('h'));
  const hashFromPath = segments[segments.indexOf(videoId) + 1];
  const hash = cleanVideoId(hashFromQuery || hashFromPath, vimeoHashPattern);
  const query = hash ? `?h=${encodeURIComponent(hash)}` : '';
  const originalPath = hash ? `/${videoId}/${hash}` : `/${videoId}`;

  return {
    provider: 'vimeo',
    providerName: 'Vimeo',
    videoId,
    originalUrl: `https://vimeo.com${originalPath}`,
    embedUrl: `https://player.vimeo.com/video/${videoId}${query}`,
    thumbnailUrl: null,
  };
}

function loomInfo(url: URL): ExternalVideoInfo | null {
  const segments = url.pathname.split('/').filter(Boolean);
  let videoId: string | null = null;

  for (let index = 0; index < segments.length; index++) {
    if ((segments[index] === 'share' || segments[index] === 'embed') && segments[index + 1]) {
      videoId = segments[index + 1];
      break;
    }
  }
  videoId ??= segments[segments.length - 1] ?? null;
  videoId = cleanVideoId(videoId, safeIdPattern);
  if (!videoId) return null;

  return {
    provider: 'loom',
    providerName: 'Loom',
    videoId,
    originalUrl: `https://www.loom.com/share/${videoId}`,
    embedUrl: `https://www.loom.com/embed/${videoId}`,
    thumbnailUrl: `https://cdn.loom.com/sessions/thumbnails/${videoId}-with-play.gif`,
  };
}

function isYouTubeHost(host: string) {
  return [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
    'youtu.be',
  ].includes(host);
}

function isVimeoHost(host: string) {
  return ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host);
}

function isLoomHost(host: string) {
  return ['loom.com', 'www.loom.com'].includes(host);
}

function normalizedHost(url: URL) {
  return url.hostname.toLowerCase().replace(/\.$/, '');
}

function cleanVideoId(value: string | null | undefined, pattern: RegExp) {
  const id = `${value ?? ''}`.trim();
  if (!id || !pattern.test(id)) return null;
  return id;
}

function youtubeStartSeconds(url: URL) {
  const raw = url.searchParams.get('start') || url.searchParams.get('t') || '';
  if (!raw) return 0;
  if (/^\d+s?$/i.test(raw)) {
    const direct = Number.parseInt(raw.replace(/s$/i, ''), 10);
    if (Number.isFinite(direct) && direct >= 0) return Math.min(direct, 12 * 60 * 60);
  }

  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw);
  if (!match) return 0;
  const hours = Number.parseInt(match[1] || '0', 10);
  const minutes = Number.parseInt(match[2] || '0', 10);
  const seconds = Number.parseInt(match[3] || '0', 10);
  return Math.min((hours * 3600) + (minutes * 60) + seconds, 12 * 60 * 60);
}

function stringOrNull(value: unknown) {
  const text = `${value ?? ''}`.trim();
  return text.length === 0 ? null : text;
}
