# Feature Gap Audit

Last updated: 2026-05-11

This audit separates what is now functional from what is still MVP-only, with the practical reason each area is delayed.

## Implemented in this pass

- Social posts now support structured attachments for uploaded images, GIFs, videos, files, and external media links.
- Student/parent/teacher comments now support rich attachments instead of text-only replies.
- Uploaded media is stored in MinIO through the backend storage route and rendered in the Flutter feed.
- Lesson content now supports ordered content blocks before questions: sections, text/markdown-style notes, uploaded images/videos/GIFs, and embedded media links.
- Student lesson flow now gates the exercise section behind a content review action when content blocks exist, and the backend rejects exercise submissions until review is confirmed.
- Content review state is persisted on progress rows with reviewed timestamp, reviewed block count, and review seconds so reloads keep lessons unlocked only for the content version the student reviewed.
- Lesson markdown rendering now supports headings, paragraphs, unordered and ordered lists, blockquotes, fenced code blocks, inline bold/italic/code/link styling, and simple markdown tables.
- Classroom posts now refresh live in Flutter through authenticated classroom WebSocket subscriptions. Post create/update/delete, comment create/update/delete, and reactions are published through Redis and relayed to connected clients.
- ntfy is wired as a real notification publisher. The API uses the correct internal service URL, exposes admin health/smoke endpoints, and publishes classroom post, lesson assignment, quiz, and whiteboard notifications to deterministic classroom topics.
- External lesson video embeds now parse YouTube, Vimeo, and Loom URLs into safe embed URLs. Flutter web renders them inline with an iframe player, while mobile/desktop keeps a browser-open fallback.
- Whiteboard sessions now expose active and recent session history in the teacher UI, support ending active sessions, and allow teachers/admins to upload and attach video recordings for replay. The backend validates recording ownership/type, returns playback URLs, and publishes a recording-ready event.

## MVP-only or underdeveloped areas

| Area | Current State | Root Cause | Roadmap Priority |
| --- | --- | --- | --- |
| Push notifications | Backend ntfy publishing is active for key classroom events, but the Flutter app does not yet manage device subscriptions or notification preferences. | Cross-platform push is not just an API call: Android can use ntfy, while iOS needs APNS or a polling/WebSocket tradeoff. Topic privacy, unsubscribe behavior, and preference UX still need product rules. | High |
| GIF search | Users can attach GIF/media URLs from Giphy, Tenor, or direct files, but there is no in-app GIF search picker yet. | Giphy/Tenor search requires provider API keys, rate-limit handling, content safety filtering, and provider attribution rules. | Medium |
| External video embeds | YouTube/Vimeo/Loom lesson URLs render inline on Flutter web and open externally on mobile/desktop. Native uploaded videos render in-app. | Android/iOS inline playback still needs a WebView/player dependency, plus provider-specific error handling for disabled embeds. | Medium |
| Media access control | Uploaded media is streamed by random file id through the API for simple web/mobile rendering. | Fully private media needs signed expiring URLs or authenticated streaming that still works with image/video widgets on every platform. | High |
| Media processing | Images/videos upload as-is; no thumbnails, compression, transcoding, duration extraction, or malware scanning yet. | Requires background jobs, storage quotas, FFmpeg/image processing, and moderation workflows. | Medium |
| Advanced lesson markdown | Text blocks now render the common markdown needed for lessons, including tables and code blocks. | Math rendering, sanitized rich HTML, and clickable deep links still need package-level rendering and content safety decisions. | Low |
| Lesson completion gating | Students must confirm content review before questions unlock, and the backend persists/requires that review before accepting submissions. | Verifying actual watch time/read time per block still needs per-block progress events, video analytics, and anti-skip rules. | Medium |
| Advanced analytics | Progress dashboards show attempts, completion, score, streak, subject mastery, and quiz XP. | Cohort analytics, item analysis, engagement funnels, and teacher intervention alerts need event tracking beyond the current progress rows. | High |
| Whiteboard recording | Teachers can start/end sessions, view recent session history, upload a recorded video, attach it to the session, and replay it from the UI. | Automatic canvas capture/export is still pending because the app needs a real drawing canvas, browser/mobile recording APIs, encoding, and upload orchestration. | Medium |
| Realtime feed updates | The Flutter feed subscribes to classroom WebSockets, reconnects after socket drops, and refreshes when classroom post/comment/reaction events arrive. | Offline state indicators, event-level local patching, cross-device notification fan-out, and background app handling are still separate product layers. | Low |
| Offline sync | Sync routes exist for selected tables, but rich media sync and conflict UX are not complete. | Binary media and rich lesson blocks need queueing, resumable upload, local cache rules, and conflict resolution UI. | Medium |
| Moderation and safety | Teachers can edit/delete their own posts and moderate comments on their posts. | Full safety requires report queues, blocked words/media scanning, audit logs, and admin moderation surfaces. | High |

## Recommended next milestones

1. Add signed media URLs and per-role access checks for private attachments.
2. Add media processing jobs for thumbnails, video poster frames, compression, upload size quotas, and basic safety scanning.
3. Add analytics events for per-block views, video watch progress, question attempts, and post engagement.
4. Add provider-backed GIF search with API keys stored in environment variables.
5. Add mobile WebView player support for YouTube, Vimeo, and Loom, with provider-specific blocked-embed fallbacks.
6. Add Flutter notification subscription management, per-classroom opt-in/out, and user-facing notification preferences.
