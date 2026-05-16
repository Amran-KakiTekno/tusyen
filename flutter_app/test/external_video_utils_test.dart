import 'package:eduapp/external_video_utils.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('externalVideoInfo', () {
    test('converts YouTube watch URLs to privacy-friendly embeds', () {
      final info = externalVideoInfo(
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s');

      expect(info?.providerName, 'YouTube');
      expect(info?.provider, 'youtube');
      expect(info?.videoId, 'dQw4w9WgXcQ');
      expect(info?.originalUri.toString(),
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=65s');
      expect(
        info?.embedUri.toString(),
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=65',
      );
    });

    test('converts short provider URLs', () {
      expect(
        externalVideoInfo('https://youtu.be/dQw4w9WgXcQ')?.embedUri.toString(),
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
      );
      expect(
        externalVideoInfo('https://vimeo.com/123456789/privatehash')
            ?.embedUri
            .toString(),
        'https://player.vimeo.com/video/123456789?h=privatehash',
      );
      expect(
        externalVideoInfo('https://www.loom.com/share/abc_DEF-123')
            ?.embedUri
            .toString(),
        'https://www.loom.com/embed/abc_DEF-123',
      );
    });

    test('rejects unsupported or malformed URLs', () {
      expect(externalVideoInfo('https://example.com/watch/123'), isNull);
      expect(
          externalVideoInfo(
              'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ'),
          isNull);
      expect(externalVideoInfo('javascript:alert(1)'), isNull);
      expect(
          externalVideoInfo('https://user:pass@youtu.be/dQw4w9WgXcQ'), isNull);
      expect(externalVideoInfo('not a url'), isNull);
    });
  });
}
