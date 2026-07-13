# Error Tracking / Central Logs

Status saat ini: internal central logs aktif dan external log drain opsional tersedia. Project punya `error_logs`, `admin_audit_logs`, `api_rate_limits`, console log, dan log deployment Vercel/Supabase.

## Sumber log saat ini

| Sumber | Isi | Lokasi |
| --- | --- | --- |
| Vercel Function Logs | Error route API admin, backup cron, build/deploy log | Vercel dashboard |
| Supabase Edge Logs | Error bot Telegram dan webhook | Supabase dashboard |
| `admin_audit_logs` | Aksi admin penting | Supabase table + halaman Log Audit |
| `error_logs` | Error API/restore/backup dan laporan client | Supabase table + halaman Error Logs |
| `api_rate_limits` | Counter rate limit admin API | Supabase table |
| Browser console | Error UI client-side | Browser user/admin |
| Better Stack/Logtail | Mirror error log ke Better Stack Telemetry HTTP ingest | Env `BETTER_STACK_INGESTING_HOST` + `BETTER_STACK_SOURCE_TOKEN` |

## Standar logging

Log yang boleh disimpan:

- `action`, `actor`, `target`, `status`, `request_id`, `created_at`.
- Error code singkat dan pesan error yang sudah disaring.
- Jumlah row atau id entity yang terdampak.

Log yang tidak boleh disimpan:

- Password, token, OTP, service role key, bot token.
- Isi credential account produk.
- Full Authorization header.

## Target upgrade

## External drain

Set env berikut di Vercel untuk web panel dan Supabase Edge Function secrets untuk bot:

```env
BETTER_STACK_INGESTING_HOST=your-source-ingesting-host
BETTER_STACK_SOURCE_TOKEN=your-source-token
```

`BETTER_STACK_INGESTING_HOST` bisa berupa host saja atau URL lengkap. Contoh:

```env
BETTER_STACK_INGESTING_HOST=s123456.eu-nbg-2.betterstackdata.com
```

Better Stack HTTP ingest menerima JSON event via `POST https://$INGESTING_HOST` dengan header `Authorization: Bearer $SOURCE_TOKEN`.

Env lama tetap didukung sebagai alias:

```env
ERROR_LOG_DRAIN_URL=https://example-log-ingest-url
ERROR_LOG_DRAIN_TOKEN=optional-bearer-token
LOGTAIL_INGEST_URL=https://example-logtail-ingest-url
LOGTAIL_SOURCE_TOKEN=optional-source-token
```

## Coverage saat ini

Jalur yang sudah masuk `error_logs` internal dan mirror Better Stack bila env aktif:

- Web admin API: products, stocks, users, vouchers, loyalty, balance.
- Backup dan restore: manual backup, cron backup, preview/append/safe replace restore.
- Ticket bridge: reply, status, resolve, dan proxy file Telegram.
- Client-reported errors via `/api/admin/error-logs`.
- Bot Edge Function: webhook catch, Telegram send/edit/callback/document/photo failure.

Jalur yang sengaja tidak dilog:

- Validasi ringan yang return langsung seperti field kosong, ID kosong, unauthorized, forbidden.
- Read-only query error yang masih return langsung di beberapa `GET` endpoint; ini bisa dinaikkan nanti jika log terlalu sedikit.

## Tahap berikut jika ingin Sentry penuh

1. Pasang Sentry untuk Next.js client + server route.
2. Pasang Sentry atau structured log wrapper untuk Supabase Edge Function.
3. Tambahkan `request_id` per API call supaya error Vercel bisa dikaitkan dengan audit log.
4. Tambahkan alert minimal:
   - Backup gagal.
   - Rate limit spike.
   - Ticket reply gagal kirim Telegram.
   - Balance add/deduct/remove error.

## Severity

| Level | Contoh | Respons |
| --- | --- | --- |
| Critical | Backup gagal berulang, service role bocor, saldo berubah massal | Investigasi langsung, rotasi secret bila perlu |
| High | Ticket reply gagal, order paid tidak masuk, voucher salah hitung | Fix hari yang sama |
| Medium | UI page error untuk sebagian data | Fix dalam 1-2 hari |
| Low | Warning visual/non-blocking | Masuk backlog |
