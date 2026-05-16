import 'dart:typed_data';

import 'package:flutter/material.dart';

class WhiteboardRecordedFile {
  const WhiteboardRecordedFile({
    required this.filename,
    required this.bytes,
    required this.durationSeconds,
    required this.mimeType,
  });

  final String filename;
  final Uint8List bytes;
  final int durationSeconds;
  final String mimeType;
}

bool get supportsWhiteboardScreenRecording => false;

Future<WhiteboardRecordedFile?> recordWhiteboardScreen(
  BuildContext context, {
  required String title,
}) async {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text('Screen recording is available in the web app.'),
    ),
  );
  return null;
}
