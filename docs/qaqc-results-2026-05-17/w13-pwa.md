# W13 PWA + Service Worker QA/QC

- Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w13-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Date: 2026-05-17
- Repo: D:\2026\tusyen
- Base URL: http://localhost
- Scope: web_app/manifest.json, web_app/sw.js, web_app/index.html
- Env source: docs/qaqc-results-2026-05-17/_env-snapshot.md
- Browser plugin: used first to load the live shell and capture browser evidence; Playwright was used for offline/network emulation that the Browser surface could not expose cleanly.

## Summary

| Check | Result | Evidence |
| --- | --- | --- |
| Manifest parses | Pass | JSON parsed successfully. |
| Manifest required fields | Pass | `name`, `short_name`, `start_url`, `display`, `icons` are present. |
| PNG icons 192/512 | Fail | `web_app/icons/icon-192.png` and `web_app/icons/icon-512.png` are missing locally; live URLs return HTML fallback, not PNG. |
| Service worker register/install/activate | Pass | Registration scope `http://localhost/`; active state reached `activated`; controller present after reload. |
| Static shell offline | Pass with risk | Offline navigation to `/` loaded the app shell after a controlled online reload. Current SW is network-first with cache fallback, not strictly cache-first. |
| `/api` offline behavior | Pass | Offline `fetch('/api/health')` rejected with `TypeError: Failed to fetch`; app displayed `API tidak dicapai: Failed to fetch`. |
| `/ws` offline behavior | Pass | Offline WebSocket to `ws://localhost/ws/` emitted `error` and did not hang. |
| Add to Home Screen criteria | Fail | Manifest and SW criteria pass, but required PNG icon assets are missing/wrong content type. |

## Environment

| Item | Value |
| --- | --- |
| Docker stack | Running from env snapshot. |
| API health | Healthy, database connected, Redis connected. |
| Web bundle | `D:\2026\tusyen\web_app\dist\app.bundle.js`, SHA256 `9CACEEFAE4EE25AEFB8B19FA605AB8624683B4627FC0D0874C3B3729B23D2E28`. |
| Worktree note | Dirty worktree already present in snapshot; no commits or env edits performed by this W13 pass. |

## Manifest validation

| Field | Value | Result |
| --- | --- | --- |
| `name` | `Tusyen — EduApp Malaysia` | Pass |
| `short_name` | `Tusyen` | Pass |
| `start_url` | `/` | Pass |
| `display` | `standalone` | Pass |
| `background_color` | `#0f0f1a` | Pass |
| `theme_color` | `#7C3AED` | Pass |
| `orientation` | `portrait-primary` | Pass |
| `lang` | `ms` | Pass |

## Icon validation

| Icon | Manifest type | Local file | Live result | Result |
| --- | --- | --- | --- | --- |
| `icons/icon-192.png` | `image/png`, `192x192` | Missing | `200 text/html; charset=utf-8` | Fail |
| `icons/icon-512.png` | `image/png`, `512x512` | Missing | `200 text/html; charset=utf-8` | Fail |
| `icons/icon.svg` | `image/svg+xml`, `any` | Present, 254 bytes | `200 image/svg+xml` | Pass |

## Service worker validation

| Check | Observed | Result |
| --- | --- | --- |
| SW support | `serviceWorker` supported in Chromium. | Pass |
| Registration | Scope `http://localhost/`. | Pass |
| Activation | Registration active state reached `activated`. | Pass |
| Controller | `navigator.serviceWorker.controller` true after reload. | Pass |
| Cache name | `tusyen-v2`. | Pass |
| Install cache entries | `/index.html`, `/styles.css`, `/app.js`, `/components/shared.jsx`, `/components/quiz.jsx`, `/components/student.jsx`, `/components/teacher.jsx`, `/components/parent.jsx`, `/components/admin.jsx`, `/manifest.json`. | Pass |
| Runtime cache entries after controlled reload | Included `/`, `/dist/app.bundle.js?v=20260517-guide`, `/styles.css?v=20260517-guide`, React CDN scripts, Nunito font, and install cache entries. | Pass |

## Offline validation

| Check | Observed | Result |
| --- | --- | --- |
| Offline navigation | With context offline, navigation to `http://localhost/` succeeded and title remained `Tusyen — EduApp Malaysia`. | Pass |
| Offline shell text | Login shell rendered, including language controls and demo account section. | Pass |
| Offline API state | UI displayed `API tidak dicapai: Failed to fetch`. | Pass |
| Offline `/api/health` | Rejected with `TypeError: Failed to fetch`. | Pass |
| Offline `/ws/` | WebSocket emitted `error`. | Pass |
| Console noise | Expected offline resource errors were captured for `/api/health` and `/ws/`. | Informational |

## Add to Home Screen criteria

| Criterion | Result | Notes |
| --- | --- | --- |
| Secure context | Pass | `http://localhost` is treated as secure for local development. |
| Manifest linked from page | Pass | `index.html` includes `<link rel="manifest" href="manifest.json">`. |
| Manifest parse and required fields | Pass | Required install fields present. |
| PNG install icons | Fail | Required 192 and 512 PNG files are missing and return HTML fallback. |
| Service worker with fetch handling | Pass | SW registered and controlled the page; fetch handler serves cached app shell on network failure. |
| Offline start URL | Pass | `/` loaded offline after controlled cache warm-up. |

Overall A2HS result: Fail until real PNG icons are added and served with `image/png`.

## Screenshots

| Screenshot | Purpose |
| --- | --- |
| `docs/qaqc-results-2026-05-17/screenshots/pwa/browser-initial-shell.png` | Browser plugin shell evidence. |
| `docs/qaqc-results-2026-05-17/screenshots/pwa/playwright-online-shell.png` | Online shell evidence. |
| `docs/qaqc-results-2026-05-17/screenshots/pwa/playwright-controlled-shell.png` | Controlled SW shell after reload. |
| `docs/qaqc-results-2026-05-17/screenshots/pwa/offline-shell.png` | Offline shell and API offline state evidence. |
| `docs/qaqc-results-2026-05-17/screenshots/pwa/defect-missing-png-icons.png` | Defect screenshot for missing/wrong-content PNG icons. |

## Defects

### Defect 1: Manifest PNG install icons are missing and served as HTML fallback

| Field | Detail |
| --- | --- |
| Role/Screen | Global / PWA installability / Add to Home Screen |
| Severity | P1 |
| Repro | Open `web_app/manifest.json`; inspect `icons/icon-192.png` and `icons/icon-512.png`; check local files under `web_app/icons/`; request the icon URLs from `http://localhost/icons/icon-192.png` and `http://localhost/icons/icon-512.png`. |
| Expected | 192x192 and 512x512 PNG files exist locally and are served as `image/png` for installability. |
| Actual | Both PNG files are missing locally. The live URLs return `200 text/html; charset=utf-8`, apparently the app HTML fallback, instead of PNG bytes. |
| Suspected file | `web_app/manifest.json`, `web_app/icons/icon-192.png`, `web_app/icons/icon-512.png`, Caddy/static fallback behavior |
| Screenshot | `docs/qaqc-results-2026-05-17/screenshots/pwa/defect-missing-png-icons.png` |

## Risks and notes

- `web_app/sw.js` is network-first with cache fallback for static GET requests. This still loaded the shell offline in the warmed controlled session, but it does not match a strict cache-first wording.
- The install-time precache does not include the current bundled script path `dist/app.bundle.js?v=20260517-guide`; it appears only after runtime caching during an online controlled reload.
- The app’s offline state is API-focused rather than a full global offline banner. The observed message was clear enough for `/api` failure: `API tidak dicapai: Failed to fetch`.
