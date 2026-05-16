class ExternalVideoInfo {
  const ExternalVideoInfo({
    required this.provider,
    required this.providerName,
    required this.videoId,
    required this.originalUri,
    required this.embedUri,
    this.thumbnailUri,
    this.startSeconds = 0,
  });

  final String provider;
  final String providerName;
  final String videoId;
  final Uri originalUri;
  final Uri embedUri;
  final Uri? thumbnailUri;
  final int startSeconds;
}

ExternalVideoInfo? externalVideoInfo(String rawUrl) {
  final uri = Uri.tryParse(rawUrl.trim());
  if (uri == null || !uri.hasScheme || !uri.hasAuthority) return null;
  if (uri.scheme != 'http' && uri.scheme != 'https') return null;
  if (uri.userInfo.isNotEmpty) return null;

  final host = _normalizedHost(uri);
  if (_isYouTubeHost(host)) {
    return _youtubeInfo(uri);
  }
  if (_isVimeoHost(host)) {
    return _vimeoInfo(uri);
  }
  if (_isLoomHost(host)) {
    return _loomInfo(uri);
  }
  return null;
}

bool supportsInlineExternalVideo(String rawUrl) {
  return externalVideoInfo(rawUrl) != null;
}

String externalVideoProviderLabel(String rawUrl) {
  return externalVideoInfo(rawUrl)?.providerName ?? '';
}

ExternalVideoInfo? _youtubeInfo(Uri uri) {
  final host = _normalizedHost(uri);
  String? videoId;

  if (host == 'youtu.be') {
    videoId = uri.pathSegments.isEmpty ? null : uri.pathSegments.first;
  } else if (uri.pathSegments.isNotEmpty) {
    final first = uri.pathSegments.first;
    if (first == 'watch') {
      videoId = uri.queryParameters['v'];
    } else if ((first == 'embed' || first == 'shorts' || first == 'live') &&
        uri.pathSegments.length > 1) {
      videoId = uri.pathSegments[1];
    }
  }

  videoId ??= uri.queryParameters['v'];
  videoId = _cleanVideoId(videoId, RegExp(r'^[A-Za-z0-9_-]{11}$'));
  if (videoId == null) return null;

  final query = <String, String>{'rel': '0'};
  final startSeconds = _youtubeStartSeconds(uri);
  if (startSeconds > 0) query['start'] = '$startSeconds';
  final originalQuery = <String, String>{'v': videoId};
  if (startSeconds > 0) originalQuery['t'] = '${startSeconds}s';

  return ExternalVideoInfo(
    provider: 'youtube',
    providerName: 'YouTube',
    videoId: videoId,
    originalUri: Uri.https('www.youtube.com', '/watch', originalQuery),
    embedUri: Uri.https('www.youtube-nocookie.com', '/embed/$videoId', query),
    thumbnailUri: Uri.https('img.youtube.com', '/vi/$videoId/hqdefault.jpg'),
    startSeconds: startSeconds,
  );
}

ExternalVideoInfo? _vimeoInfo(Uri uri) {
  final videoId = uri.pathSegments.firstWhere(
    (segment) => RegExp(r'^\d+$').hasMatch(segment),
    orElse: () => '',
  );
  if (videoId.isEmpty) return null;
  final hashFromQuery = uri.queryParameters['h'];
  final hashIndex = uri.pathSegments.indexOf(videoId) + 1;
  final hashFromPath = hashIndex > 0 && hashIndex < uri.pathSegments.length
      ? uri.pathSegments[hashIndex]
      : null;
  final hash =
      _cleanVideoId(hashFromQuery ?? hashFromPath, RegExp(r'^[A-Za-z0-9]+$'));
  final query = hash == null ? null : {'h': hash};
  final originalPath = hash == null ? '/$videoId' : '/$videoId/$hash';

  return ExternalVideoInfo(
    provider: 'vimeo',
    providerName: 'Vimeo',
    videoId: videoId,
    originalUri: Uri.https('vimeo.com', originalPath),
    embedUri: Uri.https('player.vimeo.com', '/video/$videoId', query),
  );
}

ExternalVideoInfo? _loomInfo(Uri uri) {
  String? videoId;
  for (var index = 0; index < uri.pathSegments.length; index++) {
    final segment = uri.pathSegments[index];
    if ((segment == 'share' || segment == 'embed') &&
        index + 1 < uri.pathSegments.length) {
      videoId = uri.pathSegments[index + 1];
      break;
    }
  }
  videoId ??= uri.pathSegments.isEmpty ? null : uri.pathSegments.last;
  videoId = _cleanVideoId(videoId, RegExp(r'^[A-Za-z0-9_-]+$'));
  if (videoId == null) return null;

  return ExternalVideoInfo(
    provider: 'loom',
    providerName: 'Loom',
    videoId: videoId,
    originalUri: Uri.https('www.loom.com', '/share/$videoId'),
    embedUri: Uri.https('www.loom.com', '/embed/$videoId'),
    thumbnailUri: Uri.https(
        'cdn.loom.com', '/sessions/thumbnails/$videoId-with-play.gif'),
  );
}

bool _isYouTubeHost(String host) {
  return const {
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
    'youtu.be',
  }.contains(host);
}

bool _isVimeoHost(String host) {
  return const {'vimeo.com', 'www.vimeo.com', 'player.vimeo.com'}
      .contains(host);
}

bool _isLoomHost(String host) {
  return const {'loom.com', 'www.loom.com'}.contains(host);
}

String _normalizedHost(Uri uri) => uri.host.toLowerCase().replaceAll(
      RegExp(r'\.$'),
      '',
    );

String? _cleanVideoId(String? value, RegExp pattern) {
  final id = value?.trim();
  if (id == null || id.isEmpty) return null;
  if (!pattern.hasMatch(id)) return null;
  return id;
}

int _youtubeStartSeconds(Uri uri) {
  final raw = uri.queryParameters['start'] ?? uri.queryParameters['t'];
  if (raw == null || raw.isEmpty) return 0;
  final direct = int.tryParse(raw.replaceAll('s', ''));
  if (direct != null) return direct.clamp(0, 12 * 60 * 60).toInt();

  final match = RegExp(r'^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$').firstMatch(raw);
  if (match == null) return 0;
  final hours = int.tryParse(match.group(1) ?? '') ?? 0;
  final minutes = int.tryParse(match.group(2) ?? '') ?? 0;
  final seconds = int.tryParse(match.group(3) ?? '') ?? 0;
  return ((hours * 3600) + (minutes * 60) + seconds)
      .clamp(0, 12 * 60 * 60)
      .toInt();
}
