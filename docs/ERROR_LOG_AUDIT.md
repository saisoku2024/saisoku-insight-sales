# Error Log Coverage Audit

Tanggal audit: 13 Juli 2026

## Ringkasan

SAISOKU sekarang memakai dua lapis logging:

- Internal: table Supabase `error_logs`, tampil di dashboard `Reports > Error Logs`.
- External: Better Stack/Logtail HTTP ingest jika env `BETTER_STACK_INGESTING_HOST` dan `BETTER_STACK_SOURCE_TOKEN` aktif.

## Web coverage

| Area | Status |
| --- | --- |
| Products write API | Covered |
| Stocks write API | Covered |
| Users write API | Covered |
| Vouchers write API | Covered |
| Loyalty write API | Covered |
| Balance write API | Covered |
| Backup run API | Covered |
| Restore preview/append/safe replace API | Covered |
| Ticket reply/status/resolve API | Covered |
| Ticket Telegram file proxy | Covered |
| Client-reported errors | Covered |
| Read-only GET endpoints | Partial, mostly direct JSON error |

## Bot coverage

| Area | Status |
| --- | --- |
| Webhook top-level catch | Covered |
| Telegram sendMessage | Covered |
| Telegram sendPhoto | Covered |
| Telegram sendDocument | Covered |
| Telegram editMessage | Covered |
| Telegram editCaption | Covered |
| Telegram answerCallback | Covered |
| Per-handler validation returns | Not logged by design |

## Payload standard

Semua log memakai field utama:

- `source`
- `level`
- `message`
- `stack`
- `route`
- `actor`
- `metadata`
- `service`
- `environment`
- `dt`

Field sensitif seperti token, secret, password, key, authorization, credential, dan PIN direduksi menjadi `[REDACTED]`.

## Sisa risiko

- `GET` read-only endpoint belum semuanya dicatat ke `error_logs` agar noise rendah.
- Better Stack tidak aktif sampai env source host/token dipasang.
- Log eksternal fire-and-forget dengan timeout pendek supaya tidak mengganggu user request.
