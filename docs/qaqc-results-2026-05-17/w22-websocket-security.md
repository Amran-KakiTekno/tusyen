# W22 WebSocket Auth & Isolation QA/QC

- Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w22-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Repository: D:\2026\tusyen
- Base URL: http://localhost
- Started: 2026-05-17T16:10:13.775Z
- Finished: 2026-05-17T16:10:16.619Z
- Env snapshot: docs/qaqc-results-2026-05-17/_env-snapshot.md

## Summary

- Overall: FAIL with defect
- Cross-subscription controls for enrolled classroom isolation, quiz stale participant tokens, and invalid quiz participant tokens behaved correctly.
- Reconnect storm did not crash the API container in this run.
- Strict no-token classroom websocket upgrade rejection did not behave as requested: the socket accepted the upgrade and stayed idle until the client closed it.

## Setup data

| Item | Value |
|---|---|
| Admin | admin@tusyen.test (ef0acc79-0195-4b34-b105-0bbd48c47285) |
| Teacher | teacher.w229z1cpb.teacher@tusyen.test (e4351ec5-ded5-4ddc-a62e-9f6386f9a3f1) |
| Student | student.w229z1cpb.student@tusyen.test (ff46528e-653d-4576-92ab-ced16e57c192) |
| Enrolled classroom | W22 WS Enrolled w229z1cpb / 7c8933b8-cccb-43aa-a72c-c2f2c46f542c / join 3X7BSQ |
| Isolated classroom | W22 WS Isolated w229z1cpb / 3193733d-2f24-4a44-b86f-a99e8380d432 / join WD8AZ1 |
| Quiz session A | 2c728d1c-5f12-40fe-b080-90e01934a660 / pin 466509 / classroom 7c8933b8-cccb-43aa-a72c-c2f2c46f542c |
| Quiz session B | 4e3e8aa6-c8e6-42ed-80a6-fd292edbdcfa / pin 620567 / classroom 3193733d-2f24-4a44-b86f-a99e8380d432 |
| Participant token source | 5e77f68e-5b6f-4fba-8edb-6e423cef6539 / 1e55af44-6...8e3157 |

## Check results

| Check | Status | Expected | Actual |
|---|---:|---|---|
| /ws/classroom/:id without token | FAIL | Unauthenticated classroom websocket should be rejected or promptly closed before remaining connected. | Passive no-token upgrade opened=true, closed=true, finish=timeout, events={"type":"CONNECTED","message":"Send AUTH token to join classroom"} |
| /ws/classroom/:id AUTH without token | PASS | Missing AUTH token should be rejected with an error and closed. | opened=true, closed=true, closeCode=1005, events={"type":"CONNECTED","message":"Send AUTH token to join classroom"} \| {"type":"ERROR","message":"Invalid token"} |
| Student token cannot subscribe to classroom where not enrolled | PASS | Student JWT for a non-enrolled classroom should receive Access denied and close. | opened=true, closed=true, closeCode=1005, events={"type":"CONNECTED","message":"Send AUTH token to join classroom"} \| {"type":"ERROR","message":"Access denied"} |
| Quiz WS rejects stale participant token from another session | PASS | Participant token from session A should not subscribe to session B. | opened=true, closed=true, closeCode=1005, events={"type":"CONNECTED","sessionId":"4e3e8aa6-c8e6-42ed-80a6-fd292edbdcfa","message":"Send AUTH with a teacher token or participant token to join the quiz room."} \| {"type":"ERROR","message":"Invalid participant token"} |
| Quiz WS rejects invalid participant token | PASS | Random participant token should not subscribe. | opened=true, closed=true, closeCode=1005, events={"type":"CONNECTED","sessionId":"2c728d1c-5f12-40fe-b080-90e01934a660","message":"Send AUTH with a teacher token or participant token to join the quiz room."} \| {"type":"ERROR","message":"Invalid participant token"} |
| 50 concurrent authenticated classroom WS reconnects | PASS | All 50 reconnect attempts should authenticate or fail safely, and API should remain healthy. | 50/50 AUTH_SUCCESS in 209ms; API health after=healthy; sample errors=[] |
| Inspect docker logs api | PASS | edu_api remains running/healthy with no crash-class log entries after probes. | docker inspect edu_api => running healthy; severe/error tail count=0 |

## Defects

### Defect 1

- Role/Screen: Unauthenticated visitor / Classroom WebSocket
- Severity: Medium
- Repro: Open ws://localhost/ws/classroom/7c8933b8-cccb-43aa-a72c-c2f2c46f542c with no query token and send no AUTH frame. Observe that the upgrade succeeds and the server sends CONNECTED instead of rejecting or closing the socket.
- Expected: A classroom websocket connection without a token should be rejected during upgrade or closed promptly without leaving an idle socket open.
- Actual: Connection opened and remained alive until client timeout; events: {"type":"CONNECTED","message":"Send AUTH token to join classroom"}
- Suspected file: backend/src/websocket/handlers.ts
- Screenshot: N/A - websocket protocol probe, no browser screenshot.

## Docker log inspection

- Container status: running healthy
- Tail inspected: last 200 lines from `docker logs --tail 200 edu_api`.
- Severe/error-matching lines: 0

## Raw websocket observations

### classroom_no_auth_passive

- URL: ws://localhost/ws/classroom/7c8933b8-cccb-43aa-a72c-c2f2c46f542c
- Opened: true
- Closed by server before timeout: true
- Close code: 1005
- Finish reason: timeout
- Events:
```json
[
  {
    "type": "CONNECTED",
    "message": "Send AUTH token to join classroom"
  }
]
```

### classroom_auth_missing_token

- URL: ws://localhost/ws/classroom/7c8933b8-cccb-43aa-a72c-c2f2c46f542c
- Opened: true
- Closed by server before timeout: true
- Close code: 1005
- Finish reason: server-close
- Events:
```json
[
  {
    "type": "CONNECTED",
    "message": "Send AUTH token to join classroom"
  },
  {
    "type": "ERROR",
    "message": "Invalid token"
  }
]
```

### classroom_student_not_enrolled

- URL: ws://localhost/ws/classroom/3193733d-2f24-4a44-b86f-a99e8380d432
- Opened: true
- Closed by server before timeout: true
- Close code: 1005
- Finish reason: server-close
- Events:
```json
[
  {
    "type": "CONNECTED",
    "message": "Send AUTH token to join classroom"
  },
  {
    "type": "ERROR",
    "message": "Access denied"
  }
]
```

### quiz_stale_participant_token

- URL: ws://localhost/ws/quiz/4e3e8aa6-c8e6-42ed-80a6-fd292edbdcfa
- Opened: true
- Closed by server before timeout: true
- Close code: 1005
- Finish reason: server-close
- Events:
```json
[
  {
    "type": "CONNECTED",
    "sessionId": "4e3e8aa6-c8e6-42ed-80a6-fd292edbdcfa",
    "message": "Send AUTH with a teacher token or participant token to join the quiz room."
  },
  {
    "type": "ERROR",
    "message": "Invalid participant token"
  }
]
```

### quiz_invalid_participant_token

- URL: ws://localhost/ws/quiz/2c728d1c-5f12-40fe-b080-90e01934a660
- Opened: true
- Closed by server before timeout: true
- Close code: 1005
- Finish reason: server-close
- Events:
```json
[
  {
    "type": "CONNECTED",
    "sessionId": "2c728d1c-5f12-40fe-b080-90e01934a660",
    "message": "Send AUTH with a teacher token or participant token to join the quiz room."
  },
  {
    "type": "ERROR",
    "message": "Invalid participant token"
  }
]
```

## Health snapshots

```json
{
  "before": {
    "status": "healthy",
    "database": "connected",
    "redis": "connected",
    "notifications": {
      "enabled": true,
      "connected": true,
      "statusCode": 200,
      "url": "http://ntfy",
      "publicUrl": "http://localhost:2586"
    },
    "timestamp": "2026-05-17T16:10:13.808Z"
  },
  "after": {
    "status": "healthy",
    "database": "connected",
    "redis": "connected",
    "notifications": {
      "enabled": true,
      "connected": true,
      "statusCode": 200,
      "url": "http://ntfy",
      "publicUrl": "http://localhost:2586"
    },
    "timestamp": "2026-05-17T16:10:16.493Z"
  }
}
```
