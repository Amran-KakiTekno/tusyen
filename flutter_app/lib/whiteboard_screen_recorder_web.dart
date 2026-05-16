import 'dart:async';
import 'dart:html' as html;
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

bool get supportsWhiteboardScreenRecording =>
    html.window.navigator.mediaDevices != null;

Future<WhiteboardRecordedFile?> recordWhiteboardScreen(
  BuildContext context, {
  required String title,
}) async {
  if (!supportsWhiteboardScreenRecording) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('This browser does not support recording.')),
    );
    return null;
  }

  html.MediaStream? stream;
  html.MediaRecorder? recorder;
  final chunks = <html.Blob>[];
  final stopwatch = Stopwatch();
  Timer? timer;
  final stopped = Completer<void>();

  try {
    final mediaDevices = html.window.navigator.mediaDevices as dynamic;
    stream = await mediaDevices.getDisplayMedia({
      'video': {
        'displaySurface': 'browser',
      },
      'audio': false,
    }) as html.MediaStream;

    final mimeType = _preferredMimeType();
    recorder = html.MediaRecorder(stream, {'mimeType': mimeType});

    void handleDataAvailable(html.Event event) {
      final data = (event as dynamic).data;
      if (data is html.Blob && data.size > 0) {
        chunks.add(data);
      }
    }

    void handleStop(html.Event _) {
      if (!stopped.isCompleted) stopped.complete();
    }

    recorder.addEventListener('dataavailable', handleDataAvailable);
    recorder.addEventListener('stop', handleStop);

    void stopRecording() {
      if (recorder?.state != 'inactive') {
        recorder?.stop();
      }
      for (final track in stream?.getTracks() ?? const <html.MediaStreamTrack>[]) {
        track.stop();
      }
    }

    for (final track in stream.getVideoTracks()) {
      track.onEnded.listen((_) => stopRecording());
    }

    recorder.start(1000);
    stopwatch.start();

    if (!context.mounted) {
      stopRecording();
      return null;
    }

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) {
          timer ??= Timer.periodic(const Duration(seconds: 1), (_) {
            if (dialogContext.mounted) setDialogState(() {});
          });

          if (stopped.isCompleted) {
            Future.microtask(() {
              if (dialogContext.mounted &&
                  Navigator.of(dialogContext, rootNavigator: true).canPop()) {
                Navigator.of(dialogContext, rootNavigator: true).pop();
              }
            });
          }

          return AlertDialog(
            title: const Text('Recording whiteboard'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title),
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Icon(Icons.fiber_manual_record_rounded,
                        color: Colors.redAccent),
                    const SizedBox(width: 10),
                    Text(_formatDuration(stopwatch.elapsed)),
                  ],
                ),
              ],
            ),
            actions: [
              FilledButton.icon(
                onPressed: () {
                  stopRecording();
                  Navigator.of(dialogContext, rootNavigator: true).pop();
                },
                icon: const Icon(Icons.stop_circle_rounded),
                label: const Text('Stop'),
              ),
            ],
          );
        },
      ),
    );

    if (recorder.state != 'inactive') {
      stopRecording();
    }
    await stopped.future.timeout(const Duration(seconds: 5), onTimeout: () {});

    if (chunks.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No recording data was captured.')),
      );
      return null;
    }

    final blob = html.Blob(chunks, mimeType);
    final bytes = await _blobToBytes(blob);
    if (bytes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('The recording file was empty.')),
      );
      return null;
    }

    return WhiteboardRecordedFile(
      filename: 'whiteboard-${DateTime.now().millisecondsSinceEpoch}.webm',
      bytes: bytes,
      durationSeconds: stopwatch.elapsed.inSeconds,
      mimeType: _uploadMimeType(mimeType),
    );
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Recording failed: $error')),
      );
    }
    return null;
  } finally {
    timer?.cancel();
    for (final track in stream?.getTracks() ?? const <html.MediaStreamTrack>[]) {
      track.stop();
    }
  }
}

String _preferredMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  for (final candidate in candidates) {
    if (html.MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return 'video/webm';
}

String _uploadMimeType(String recorderMimeType) {
  return recorderMimeType.split(';').first.trim().isEmpty
      ? 'video/webm'
      : recorderMimeType.split(';').first.trim();
}

Future<Uint8List> _blobToBytes(html.Blob blob) async {
  final reader = html.FileReader();
  reader.readAsArrayBuffer(blob);
  await reader.onLoadEnd.first;
  final result = reader.result;
  if (result is ByteBuffer) return result.asUint8List();
  if (result is Uint8List) return result;
  return Uint8List(0);
}

String _formatDuration(Duration duration) {
  final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}
