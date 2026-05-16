import { describe, expect, it } from 'vitest';
import {
  ExternalVideoError,
  assertExternalVideoInfo,
  externalVideoInfo,
  normalizeExternalVideoAttachment,
  normalizeExternalVideoBlock,
} from '../src/external-video';

describe('external video helpers', () => {
  it('canonicalizes YouTube links to privacy-friendly embeds', () => {
    const info = externalVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s');

    expect(info?.provider).toBe('youtube');
    expect(info?.originalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=65s');
    expect(info?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=65');
    expect(info?.thumbnailUrl).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('supports Vimeo privacy hashes and Loom share links', () => {
    expect(externalVideoInfo('https://vimeo.com/123456789/privatehash')?.embedUrl)
      .toBe('https://player.vimeo.com/video/123456789?h=privatehash');
    expect(externalVideoInfo('https://www.loom.com/share/abc_DEF-123')?.embedUrl)
      .toBe('https://www.loom.com/embed/abc_DEF-123');
  });

  it('rejects spoofed hosts, credentials, and unsupported providers', () => {
    expect(externalVideoInfo('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(externalVideoInfo('https://user:pass@youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(externalVideoInfo('https://example.com/watch/123')).toBeNull();
    expect(() => assertExternalVideoInfo('https://example.com/watch/123')).toThrow(ExternalVideoError);
  });

  it('normalizes attachment and lesson block metadata', () => {
    const attachment = normalizeExternalVideoAttachment({
      type: 'embed',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      name: 'Revision clip',
    });
    const block = normalizeExternalVideoBlock({
      type: 'embed',
      url: 'https://www.loom.com/share/abc_DEF-123',
      title: 'Walkthrough',
    });

    expect(attachment).toMatchObject({
      type: 'embed',
      provider: 'youtube',
      providerName: 'YouTube',
      providerVideoId: 'dQw4w9WgXcQ',
      name: 'Revision clip',
      mimeType: 'text/html',
    });
    expect(block).toMatchObject({
      type: 'embed',
      provider: 'loom',
      providerName: 'Loom',
      providerVideoId: 'abc_DEF-123',
    });
  });
});
