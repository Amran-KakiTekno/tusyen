# W11 Whiteboard QA/QC

- Workstream: W11 Whiteboard
- Repository: `D:\2026\tusyen`
- Run ID: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `w11-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Environment snapshot: `docs/qaqc-results-2026-05-17/_env-snapshot.md`
- Base URL: `http://localhost`
- Scope tested: `/whiteboard/*`, `/ws/classroom/:classroomId`, and protected storage playback used by whiteboard recordings
- Tools used: Playwright request API, Codex Browser, Node WebSocket client
- Status: **FAIL with defects**

## Test Data

| Item | Value |
| --- | --- |
| Classroom ID | `34d98120-27a7-4197-b07d-8b15c07d4f1b` |
| Session ID | `ff6e4a86-cc34-46ad-9072-f2fb84bd7514` |
| Teacher | `teacher.w11-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-1779031834695@tusyen.test` |
| Enrolled student | `student.w11-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-1779031834695@tusyen.test` |
| Non-enrolled student | `outsider.w11-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-1779031834695@tusyen.test` |
| MP4 file ID used for attach | `7fdcddcf-76dc-44f4-bec3-064cba37b0d3` |

## Summary

- Whiteboard session start, active-session API visibility, duplicate-start prevention, student join token/channel, end-session API state, MP4 attach, signed playback, invalid MIME rejection, recording removal, and non-enrolled API denial all passed.
- Student Browser active-session visibility passed: the Whiteboard screen showed the W11 active session card, active state, participant count, and `Sertai papan` button with no console warnings/errors.
- Student Browser ended-session history visibility failed: after ending the session, the Whiteboard screen only rendered `Tiada papan putih aktif` and did not show the ended W11 session, despite `/api/whiteboard/sessions/:classroomId` returning it.
- WebSocket draw persistence partially passed: all draw events were persisted and `/events` returned ascending sequence numbers, but rapid single-client sends were assigned payload order `draw-1, draw-3, draw-2`, not the client send order `draw-1, draw-2, draw-3`.

## Check Results

| Check | Method | Result | Evidence |
| --- | --- | --- | --- |
| Start session active visible | Playwright request plus Browser | PASS | `POST /api/whiteboard/session` returned `status=active`; enrolled student `GET /api/whiteboard/session/active/:classroomId` returned `active=true`; Browser showed active W11 card and join button. |
| Duplicate start prevented | Playwright request | PASS | Second `POST /api/whiteboard/session` for the same classroom returned `409` with `This classroom already has an active whiteboard session`. |
| Student can join active session | Playwright request | PASS | `POST /api/whiteboard/session/:id/join` returned a Centrifugo token and `channel=whiteboard:ff6e4a86-cc34-46ad-9072-f2fb84bd7514`. |
| WS draw events persisted | Node WebSocket client plus Playwright request | PASS | WebSocket messages included `CONNECTED`, `AUTH_SUCCESS`, `PRESENCE`, and `PONG`; `GET /api/whiteboard/session/:id/events` returned 3 persisted draw events. |
| `/events` replay ordered by persisted sequence | Playwright request | PARTIAL | Replay returned sequence numbers `1,2,3`, and `afterSequence=1` returned `2,3`; payload labels were ordered `draw-1,draw-3,draw-2`, which is a defect for client-send order. |
| End session then student history visible | Playwright request plus Browser | FAIL | API history returned the ended session with `status=ended`; Browser student Whiteboard showed only `Tiada papan putih aktif` and no W11 history/replay row. |
| Upload MP4 recording and attach | Playwright request | PASS | Whiteboard bucket upload used `video/mp4`; `POST /api/whiteboard/session/:id/recording` returned the same file ID and `mimeType=video/mp4`. |
| Signed playback URL works | Playwright request | PASS | Signed playback URL contained `mediaToken`; range request returned `206`, `content-type=video/mp4`, and `content-range=bytes 0-15/51`. |
| Invalid MIME rejected | Playwright request | PASS | Whiteboard bucket upload with `text/plain` was rejected at attach with `400` and `Recording must be an MP4, WebM, or MOV video`. |
| Remove recording removes replay URL | Playwright request | PASS | `DELETE /api/whiteboard/session/:id/recording` returned `recording_status=none`; student history `recording_url=null`; stale signed playback URL returned `404 File not found`. |
| Non-enrolled denied | Playwright request | PASS | Non-enrolled student received `403` for active lookup, join, events replay, and session history. |

## Defects

### Defect 1: Ended whiteboard sessions are not visible in the student Whiteboard UI

| Field | Details |
| --- | --- |
| Role/Screen | Student / Whiteboard |
| Severity | High |
| Repro | Create a classroom, enroll a student, start a whiteboard session, confirm the student sees it active, end the session, refresh/check the student Whiteboard screen. |
| Expected | The ended session should remain visible in student history. When a recording is attached, the student should have a replay/playback entry; after removal, the session should remain visible without a replay URL. |
| Actual | API `GET /api/whiteboard/sessions/:classroomId` returned the ended session, but Browser showed only `Tiada papan putih aktif` and did not render the ended W11 session or any history area. |
| Suspected file | `web_app/components/student.jsx:1218` and `web_app/components/student.jsx:1541`; the student hook/UI appears to query only active sessions and render active rows, not `/whiteboard/sessions/:classroomId` history. |
| Screenshot | Not captured as a file; Browser DOM evidence showed `main "Whiteboard"` with `Tiada papan putih aktif` and no W11 session history after refresh. |

### Defect 2: Rapid WebSocket draw events can persist out of client send order

| Field | Details |
| --- | --- |
| Role/Screen | Whiteboard realtime / classroom WebSocket |
| Severity | Medium |
| Repro | Start a whiteboard session, connect to `/ws/classroom/:classroomId`, authenticate as teacher, send three `WHITEBOARD_DRAW` messages rapidly in one socket as `w11-draw-1`, `w11-draw-2`, `w11-draw-3`, then call `GET /api/whiteboard/session/:id/events`. |
| Expected | Persisted sequence order should match single-client WebSocket send order: `w11-draw-1`, `w11-draw-2`, `w11-draw-3`. |
| Actual | `/events` returned sequence numbers `1,2,3`, but payload labels were `w11-draw-1`, `w11-draw-3`, `w11-draw-2`. Replay is sorted by sequence, but sequence assignment can race relative to the client message order. |
| Suspected file | `backend/src/websocket/handlers.ts`; the async `message` handler persists draw events without a per-socket or per-session processing queue, so transaction completion order can assign sequences out of send order. |
| Screenshot | N/A; API/WS evidence from the run: `orderedSequences=[1,2,3]`, `eventLabels=[w11-draw-1,w11-draw-3,w11-draw-2]`. |

## Residual Risk

- MP4 playback was verified by signed HTTP range request, not by an in-browser `<video>` decode, because the student history/replay UI did not expose the ended session.
- The pass/fail scope was limited to the whiteboard lifecycle, WebSocket draw persistence, protected recording playback, and access control paths requested for W11.
- No source code, environment files, commits, or git operations were changed; this report file is the only repository deliverable updated by this pass.
