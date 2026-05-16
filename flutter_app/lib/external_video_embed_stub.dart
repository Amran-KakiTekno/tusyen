import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'external_video_utils.dart';

class ExternalVideoEmbed extends StatelessWidget {
  const ExternalVideoEmbed({
    required this.url,
    required this.title,
    super.key,
  });

  final String url;
  final String title;

  @override
  Widget build(BuildContext context) {
    final info = externalVideoInfo(url);
    final provider = info?.providerName ?? 'External video';
    final uri = info?.originalUri ?? Uri.tryParse(url);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withOpacity(0.16),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              Icons.play_circle_rounded,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                Text(
                  '$provider opens in the browser on this platform',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
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
