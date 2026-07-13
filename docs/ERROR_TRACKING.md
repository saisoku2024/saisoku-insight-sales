# Error Tracking / Central Logs

Status saat ini: partial. Project sudah punya `admin_audit_logs`, `api_rate_limits`, console log, dan log deployment Vercel/Supabase. Belum ada error tracking terpusat seperti Sentry atau log pipeline seperti Logtail/Axiom.

## Sumber log saat ini

| Sumber | Isi | Lokasi |
| --- | --- | --- |
| Vercel Function Logs | Error route API admin, backup cron, build/deploy log | Vercel dashboard |
| Supabase Edge Logs | Error bot Telegram dan webhook | Supabase dashboard |
| `admin_audit_logs` | Aksi admin penting | Supabase table + halaman Log Audit |
| `api_rate_limits` | Counter rate limit admin API | Supabase table |
| Browser console | Error UI client-side | Browser user/admin |

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

Tahap berikut yang direkomendasikan:

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
