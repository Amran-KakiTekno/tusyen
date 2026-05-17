# W8 Feed / Posts / Comments / Reactions / Realtime QAQC

- Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w8-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Probe suffix: W89XUKT5C450
- Started: 2026-05-17T15:36:58.073Z
- Finished: 2026-05-17T15:37:05.222Z
- Environment snapshot: docs/qaqc-results-2026-05-17/_env-snapshot.md
- Base URL: http://localhost
- ntfy URL: http://localhost:2586
- Overall result: PARTIAL / DEFECTS FOUND

## Scope exercised

- `/api/feed/posts` create/list/edit/delete for announcement, assignment, and general posts.
- Rich post attachments: image, GIF, video, file, YouTube, Vimeo, and Loom embeds.
- Unsupported embed rejection.
- Comment create with attachments, own edit, own delete, teacher moderation, and admin moderation.
- Reaction add, update, remove, returned engagement counts, and realtime event names.
- `/ws/classroom/:classroomId` enrolled-student and non-enrolled-student behavior.
- Non-enrolled feed read/comment authorization.
- ntfy classroom topic polling for `tusyen_classroom_<uuid>`.

## Summary

- Checks passed: 17
- Checks failed: 3
- Defects logged: 3

## Check results

| Check | Result | Evidence |
|---|---:|---|
| Environment health | PASS | /api/health database=connected, redis=connected, ntfy=true |
| QA actors and classroom setup | PASS | Created classroom 6170ebe9-e6ba-47da-baa8-13f4e2fb889f, linked parent, enrolled one student, kept outsider unenrolled. |
| Enrolled student websocket authentication | PASS | Observed CONNECTED, AUTH_SUCCESS. |
| Non-enrolled websocket access | PASS | Rejected with CONNECTED, ERROR. |
| Media upload prerequisites | PASS | Uploaded image/GIF/video/file for teacher and one student-owned comment file. |
| Post attachments and allowed embeds | PASS | Types=embed, embed, embed, file, gif, image, video; providers=loom, vimeo, youtube. |
| Realtime NEW_POST | PASS | Observed NEW_POST. |
| ntfy classroom post notification | PASS | Found matching message on tusyen_classroom_6170ebe9-e6ba-47da-baa8-13f4e2fb889f. |
| Post edit and pin lifecycle | PASS | Teacher edited title/content and unpinned pinned announcement. |
| Post types announcement/assignment/general | PASS | Created announcement, assignment, general. |
| Unsupported embed rejection | PASS | Rejected with 400: {"error":"External video embeds must be YouTube, Vimeo, or Loom links"} |
| Post soft-delete lifecycle | PASS | Deleted assignment no longer appears in enrolled student feed. |
| Comment attach/edit own/delete own | PASS | Student attached file/embed, edited own comment, then soft-deleted it. |
| Teacher delete any comment on own post | PASS | Teacher deleted a student comment on the teacher-owned post. |
| Admin delete any comment | PASS | Admin deleted a student comment on the classroom post. |
| Realtime NEW_COMMENT | FAIL | Expected NEW_COMMENT; observed NEW_POST_COMMENT. |
| Reaction add/update/remove like counter | PASS | like={<br>  "like_count": 1,<br>  "comment_count": 1,<br>  "my_reaction": "like"<br>}, love={<br>  "like_count": 0,<br>  "comment_count": 1,<br>  "my_reaction": "love"<br>}, remove={<br>  "like_count": 0,<br>  "comment_count": 1,<br>  "my_reaction": null<br>}. |
| Realtime REACTION_UPDATED | FAIL | Expected REACTION_UPDATED; observed POST_REACTION, POST_REACTION, POST_REACTION. |
| Per-reaction counts for non-like reactions | FAIL | Love response keys: like_count, comment_count, my_reaction. |
| Non-enrolled read/comment authorization | PASS | Feed list status=200 without target post; comment status=403. |

## Defects

### W8-FEED-01

- Role/Screen: Student / Feed websocket comments
- Severity: P1
- Repro: Connected enrolled student websocket; create comment.
- Expected: NEW_COMMENT.
- Actual: Received NEW_POST_COMMENT instead.
- Suspected file: backend/src/feed/routes.ts
- Screenshot: N/A (API/WebSocket probe)

### W8-FEED-02

- Role/Screen: Student / Feed websocket reactions
- Severity: P1
- Repro: Connected enrolled student websocket; add/update/remove reaction.
- Expected: REACTION_UPDATED for reaction changes.
- Actual: Received POST_REACTION, POST_REACTION, POST_REACTION instead.
- Suspected file: backend/src/feed/routes.ts
- Screenshot: N/A (API/WebSocket probe)

### W8-FEED-03

- Role/Screen: Student / Feed reaction counts
- Severity: P2
- Repro: React with love/insightful/celebrate.
- Expected: Counts for each allowed reaction type or reactionCounts map.
- Actual: Engagement exposes only like_count, comment_count, my_reaction.
- Suspected file: backend/src/feed/routes.ts
- Screenshot: N/A (API/WebSocket probe)

## Evidence

```json
{
  "baseUrl": "http://localhost",
  "ntfyBase": "http://localhost:2586",
  "runId": "qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e",
  "namespace": "w8-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e",
  "suffix": "W89XUKT5C450",
  "ids": {
    "adminId": "ef0acc79-0195-4b34-b105-0bbd48c47285",
    "teacherId": "4540a0b4-1f64-4d2a-a43e-7fa6a6b45440",
    "studentId": "7e8697ec-b1bc-4a17-a545-a74d02539d71",
    "parentId": "0f32672d-ec1d-40df-a2ee-3939bc63370c",
    "nonEnrolledId": "c176b467-1f4f-4717-bb59-40d513f17616",
    "classroomId": "6170ebe9-e6ba-47da-baa8-13f4e2fb889f",
    "announcementPostId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
    "assignmentPostId": "2f1aa6af-d993-414f-8ca0-4cef5274447e",
    "generalPostId": "ff5fccfa-31c9-4fe4-8012-d2ec4f85ff67",
    "ownCommentId": "54f77cee-cf61-4ac0-954c-aaf0b3b3b071",
    "realtimeCommentId": "20747513-6f1e-47bc-a8de-87087d6e451e"
  },
  "websocketEvents": [
    {
      "label": "enrolled-student",
      "type": "CONNECTED",
      "postId": null,
      "commentId": null,
      "message": "Send AUTH token to join classroom"
    },
    {
      "label": "enrolled-student",
      "type": "AUTH_SUCCESS",
      "postId": null,
      "commentId": null,
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "PRESENCE",
      "postId": null,
      "commentId": null,
      "message": null
    },
    {
      "label": "non-enrolled-student",
      "type": "CONNECTED",
      "postId": null,
      "commentId": null,
      "message": "Send AUTH token to join classroom"
    },
    {
      "label": "non-enrolled-student",
      "type": "ERROR",
      "postId": null,
      "commentId": null,
      "message": "Access denied"
    },
    {
      "label": "enrolled-student",
      "type": "USER_LEFT",
      "postId": null,
      "commentId": null,
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "NEW_POST",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": null,
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "POST_UPDATED",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": null,
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "NEW_POST",
      "postId": "2f1aa6af-d993-414f-8ca0-4cef5274447e",
      "commentId": null,
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "NEW_POST",
      "postId": "ff5fccfa-31c9-4fe4-8012-d2ec4f85ff67",
      "commentId": null,
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "POST_DELETED",
      "postId": "2f1aa6af-d993-414f-8ca0-4cef5274447e",
      "commentId": null,
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "NEW_POST_COMMENT",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": "54f77cee-cf61-4ac0-954c-aaf0b3b3b071",
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "POST_COMMENT_UPDATED",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": "54f77cee-cf61-4ac0-954c-aaf0b3b3b071",
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "POST_COMMENT_DELETED",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": "54f77cee-cf61-4ac0-954c-aaf0b3b3b071",
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "NEW_POST_COMMENT",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": "9aabbaf5-f969-4b32-b94d-c3ffd19da7d8",
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "POST_COMMENT_DELETED",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": "9aabbaf5-f969-4b32-b94d-c3ffd19da7d8",
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "NEW_POST_COMMENT",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": "4fe67553-fd4b-465c-a944-bbb1634f461a",
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "POST_COMMENT_DELETED",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": "4fe67553-fd4b-465c-a944-bbb1634f461a",
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "NEW_POST_COMMENT",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": "20747513-6f1e-47bc-a8de-87087d6e451e",
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "POST_REACTION",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": null,
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "POST_REACTION",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": null,
      "message": null
    },
    {
      "label": "enrolled-student",
      "type": "POST_REACTION",
      "postId": "50de3c18-f2e9-4b7d-b28e-ff72b38ad3a5",
      "commentId": null,
      "message": null
    }
  ],
  "ntfy": {
    "topic": "tusyen_classroom_6170ebe9-e6ba-47da-baa8-13f4e2fb889f",
    "url": "http://localhost:2586/tusyen_classroom_6170ebe9-e6ba-47da-baa8-13f4e2fb889f/json?poll=1&since=1h",
    "matched": true,
    "messageCount": 1,
    "match": {
      "id": "f0ZQT1UiGUmN",
      "time": 1779032218,
      "expires": 1779075418,
      "event": "message",
      "topic": "tusyen_classroom_6170ebe9-e6ba-47da-baa8-13f4e2fb889f",
      "title": "W8 Feed Realtime W89XUKT5C450: new post",
      "message": "W8 Announcement W89XUKT5C450",
      "priority": 3,
      "tags": [
        "memo",
        "matematik_w89xukt5c450"
      ],
      "click": "http://localhost/"
    }
  }
}
```

## Residual risk

- This was an API/WebSocket/ntfy probe, not a visual browser UI pass of the React feed screen.
- Test data was created under the W8 namespace and soft-deleted where the lifecycle required deletion; source files, env files, and git state were not changed.
- The non-enrolled feed list currently returns an empty 200 rather than a hard 403; this pass treats that as non-readable because the protected post is not exposed, but product/security may prefer explicit denial.