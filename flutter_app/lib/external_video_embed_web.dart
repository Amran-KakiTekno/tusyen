import 'dart:html' as html;
import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'external_video_utils.dart';

class ExternalVideoEmbed extends StatefulWidget {
  const ExternalVideoEmbed({
    required this.url,
    required this.title,
    super.key,
  });

  final String url;
  final String title;

  @override
  State<ExternalVideoEmbed> createState() => _ExternalVideoEmbedState();
}

class _ExternalVideoEmbedState extends State<ExternalVideoEmbed> {
  late final ExternalVideoInfo? _info = externalVideoInfo(widget.url);
  late final String _viewType =
      'external-video-${identityHashCode(this)}-${_info?.embedUri.hashCode ?? 0}';

  @override
  void initState() {
    super.initState();
    final info = _info;
    if (info == null) return;

    ui_web.platformViewRegistry.registerViewFactory(_viewType, (viewId) {
      final iframe = html.IFrameElement()
        ..src = info.embedUri.toString()
        ..title = widget.title.isEmpty ? info.providerName : widget.title
        ..allow =
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        ..referrerPolicy = 'strict-origin-when-cross-origin';

      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox',
      );
      iframe.style
        ..border = '0'
        ..width = '100%'
        ..height = '100%';

      return iframe;
    });
  }

  @override
  Widget build(BuildContext context) {
    final info = _info;
    if (info == null) {
      return _ExternalVideoFallback(url: widget.url, title: widget.title);
    }

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: HtmlElementView(viewType: _viewType),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(
                  Icons.play_circle_rounded,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.title.isEmpty
                        ? '${info.providerName} video'
                        : widget.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: () => launchUrl(info.originalUri),
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('Open'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExternalVideoFallback extends StatelessWidget {
  const _ExternalVideoFallback({required this.url, required this.title});

  final String url;
  final String title;

  @override
  Widget build(BuildContext context) {
    final uri = Uri.tryParse(url);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Row(
        children: [
          Icon(
            Icons.link_rounded,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleMedium),
          ),
          OutlinedButton.icon(
            onPressed: uri == null ? null : () => launchUrl(uri),
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('Open'),
          ),
        ],
      ),
    );
  }
}
