# W12 Storage + Sync QA/QC

- Workstream: W12 Storage + Sync
- Shared run id: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `w12-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Environment snapshot: `docs/qaqc-results-2026-05-17/_env-snapshot.md`
- Base URL tested: `http://localhost`
- Tooling: Playwright API request context with multipart upload bodies
- Scope: `/storage/*`, `/sync/*`
- Status: **FAIL - blocking defects found**

## Summary

Storage owner flows mostly work: authenticated multipart upload, owner list, protected owner content download, delete, post-delete list exclusion, and cross-user access denial all passed. Signed URL creation returns a URL, but the returned URL points at the internal Docker hostname `minio`, so it was not retrievable from the QA host. Storage validation is also incomplete: executable MIME uploads are accepted, and a file larger than the configured 100 MB multipart cap is accepted after truncation instead of being rejected.

Sync conflict resolve returns `{ "success": true }`, and device checkpoint status updates. Sync push can insert a `student_notes` record, but `/sync/pull` does not return that pushed record when requesting `student_notes`, so push/pull round-trip fails for a table that `/sync/push` explicitly supports.

## Environment confirmation

| Check | Result | Evidence |
| --- | --- | --- |
| `/api/health` through Caddy | PASS | 200, database=`connected`, redis=`connected` |
| Teacher login | PASS | `teacher@tusyen.test`, role=`teacher` |
| Student login | PASS | `student@tusyen.test`, role=`student` |
| Configured upload cap | Observed | `@fastify/multipart` fileSize limit is 100 MB in `backend/src/index.ts` |

## Storage checks

| Check | Expected | Actual | Result |
| --- | --- | --- | --- |
| Multipart upload, `text/plain` | 200 with `success=true` and `fileId` | 200, fileId `a66cac1e-42e8-4926-88ab-1e0ce7054f8d` | PASS |
| List owner files | Uploaded file appears in `GET /api/storage/files` | File id present in owner list | PASS |
| Owner protected content | `GET /api/storage/files/:id/content` returns uploaded body | 200, body matched `W12 storage payload ...` | PASS |
| Signed download URL minted | `POST /api/storage/download-url` returns URL | 200, URL returned | PASS |
| Signed download URL retrievable | Direct GET of signed URL returns file body | Failed DNS lookup for `http://minio:9000/...` from QA host | FAIL |
| Cross-user content access | Student cannot read teacher file | 403 `Not authorized to access this media` | PASS |
| Cross-user signed URL | Student cannot mint signed URL for teacher file | 403 `Not authorized to download this file` | PASS |
| Disallowed MIME | `application/x-msdownload` rejected with 4xx | 200, file accepted with MIME `application/x-msdownload` | FAIL |
| Oversized upload | 100 MB + 1 byte rejected with 4xx | 200, stored as size `104857600` bytes | FAIL |
| Owner delete | `DELETE /api/storage/files/:id` returns success | 200 `{ "success": true }` | PASS |
| Post-delete list | Deleted file omitted from owner list | File id absent, list count 0 | PASS |

Cleanup: the valid uploaded file, disallowed-MIME file, and oversized/truncated file were deleted after their checks.

## Sync checks

| Check | Expected | Actual | Result |
| --- | --- | --- | --- |
| Pull existing progress fixture | `/api/sync/pull` returns progress references usable for retry setup | 200, 3 progress rows; reference lesson `2e741347-8312-43f9-9fc0-017ff3613ecb` | PASS |
| Push new progress record | 200, `success=1`, new progress id returned | 200, `success=0`, duplicate unique constraint on `(student_id, lesson_id, classroom_id)` | INCONCLUSIVE SETUP GAP |
| Push new `student_notes` record | 200, `success=1`, new note returned | 200, note id `9ae388ed-a187-4dd1-bd78-e29bab32e7df` inserted | PASS |
| Pull pushed `student_notes` record | `/api/sync/pull` returns pushed note in `changes.student_notes` | 200, `changes.student_notes=[]` | FAIL |
| Sync status | Device checkpoint recorded after push | 200, device id present | PASS |
| Conflict resolve payload | `POST /api/sync/resolve` returns `{ "success": true }` | 200 `{ "success": true }` | PASS |

Residual test data: one namespaced `student_notes` row was created because the API proved insertion success but pull does not expose it. I did not perform direct DB cleanup because the requested scope was API QA and the route-level failure should remain traceable by namespace.

## Defects

### W12-01 - Signed download URL is internal-only and not retrievable from QA host

- Role/Screen: Teacher / Storage signed download URL
- Severity: High
- Repro: Login as teacher, upload `text/plain` via `POST /api/storage/upload`, then call `POST /api/storage/download-url` with the returned `fileId`; direct GET the returned URL from the QA host.
- Expected: Signed URL is usable by the API client/browser that requested it and returns the uploaded file body.
- Actual: API returns `http://minio:9000/...`; direct GET fails with `getaddrinfo ENOTFOUND minio` from the QA host.
- Suspected file: `backend/src/storage/routes.ts`, `backend/src/config.ts`
- Screenshot: N/A - API-only Playwright request check.

### W12-02 - Disallowed MIME upload is accepted

- Role/Screen: Teacher / Storage multipart upload
- Severity: High
- Repro: Login as teacher and upload multipart file `w12-...exe` with MIME `application/x-msdownload` to `POST /api/storage/upload`.
- Expected: 4xx rejection for disallowed executable MIME type.
- Actual: 200 response with `success=true`, `mimeType="application/x-msdownload"`, and a stored file id.
- Suspected file: `backend/src/storage/routes.ts`
- Screenshot: N/A - API-only Playwright request check.

### W12-03 - Oversized upload over configured cap is accepted after truncation

- Role/Screen: Teacher / Storage multipart upload
- Severity: High
- Repro: Login as teacher and upload multipart file of `104857601` bytes to `POST /api/storage/upload`; configured multipart cap is `100 * 1024 * 1024` bytes.
- Expected: 4xx rejection because payload exceeds the configured 100 MB cap.
- Actual: 200 response with `success=true`; stored metadata reports `size=104857600`, indicating the upload was truncated to the cap and persisted.
- Suspected file: `backend/src/storage/routes.ts`, `backend/src/index.ts`
- Screenshot: N/A - API-only Playwright request check.

### W12-04 - Sync push supports `student_notes`, but sync pull never returns the pushed note

- Role/Screen: Student / Offline sync push-pull
- Severity: High
- Repro: Login as student, call `POST /api/sync/push` with an `INSERT` operation for table `student_notes`, then call `POST /api/sync/pull` with `tables=["student_notes"]` and `lastSyncAt=1970-01-01T00:00:00.000Z`.
- Expected: The newly inserted note appears in `changes.student_notes`.
- Actual: Push succeeds with note id `9ae388ed-a187-4dd1-bd78-e29bab32e7df`, but pull returns `changes.student_notes=[]`.
- Suspected file: `backend/src/sync/routes.ts`
- Screenshot: N/A - API-only Playwright request check.

## Observations and residual risk

- `POST /api/sync/resolve` returns `{ "success": true }` even for a random conflict id. This satisfies the payload check but may hide invalid conflict-resolution requests if the product expects 404 or row-count validation.
- Progress insert retry could not create a new progress row with the pulled lesson/classroom reference because the seed data already had the unique `(student_id, lesson_id, classroom_id)` tuple. This is not counted as a primary defect; the `student_notes` path demonstrates a successful push and failed pull round-trip on a sync-supported table.
- A direct database fixture lookup was attempted for setup discovery, but local `psql` access inside the postgres container did not authenticate with `eduuser` or `postgres` socket roles. The final sync evidence uses `/sync/pull` data instead.

## Verdict

W12 should not pass QA/QC yet. Fix storage validation and public signed URL generation first, then add/repair `student_notes` handling in sync pull and rerun the W12 checks.
