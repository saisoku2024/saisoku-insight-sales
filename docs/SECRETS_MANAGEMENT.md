# Secrets Management

Dokumen ini adalah registry dan SOP secret SAISOKU. Jangan pernah menaruh nilai secret asli di Git, chat, screenshot, atau dokumen ini.

## Registry secret

| Secret | Lokasi | Owner | Rotasi normal | Rotasi darurat |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env, `.env.local` dev | Owner | Saat project Supabase berubah | Jika project dipindah |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env, `.env.local` dev | Owner | 90 hari atau saat policy berubah besar | Jika key bocor |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env server-side, Supabase function secret bila dibutuhkan | Owner only | 60-90 hari | Wajib langsung jika bocor |
| `TELEGRAM_BOT_TOKEN` | Supabase Edge Function secret | Owner only | 90 hari | Wajib langsung jika bocor |
| `BACKUP_CRON_SECRET` | Vercel env | Owner | 90 hari | Jika log/request bocor |
| `SAISOKU_BACKUP_BUCKET` | Vercel env | Owner/Admin teknis | Saat nama bucket berubah | Jika bucket policy salah |
| `SAISOKU_BACKUP_DIR` | Local backup env opsional | Owner/Admin teknis | Saat struktur folder berubah | Jika komputer dev bocor |
| `BETTER_STACK_INGESTING_HOST` | Vercel env + Supabase Edge Function secret | Owner/Admin teknis | Saat source Better Stack berubah | Jika source token bocor |
| `BETTER_STACK_SOURCE_TOKEN` | Vercel env + Supabase Edge Function secret | Owner only | 60-90 hari | Wajib langsung jika bocor |

## Aturan penyimpanan

- Secret production hanya disimpan di Vercel Environment Variables dan Supabase Secrets.
- `.env.local` hanya untuk development lokal dan tidak boleh di-commit.
- Secret dengan akses tulis tinggi, terutama `SUPABASE_SERVICE_ROLE_KEY`, tidak boleh memakai prefix `NEXT_PUBLIC_`.
- Screenshot halaman environment harus disensor sebelum dibagikan.

## SOP jika token bocor

1. Anggap secret sudah dipakai pihak luar.
2. Regenerate secret di sumber utamanya:
   - Supabase dashboard untuk anon/service role key.
   - BotFather untuk `TELEGRAM_BOT_TOKEN`.
   - Buat nilai baru random untuk `BACKUP_CRON_SECRET`.
3. Update secret di Vercel dan Supabase Edge Function.
4. Redeploy web dan Edge Function yang memakai secret tersebut.
5. Jalankan health checklist dari `docs/AVAILABILITY_RECOVERY.md`.
6. Cek `admin_audit_logs`, `api_rate_limits`, order, balance, voucher, dan ticket untuk aktivitas aneh.
7. Buat catatan incident: waktu bocor, secret apa, tindakan rotasi, dan dampak.

## Checklist sebelum deploy

- Tidak ada nilai secret di source code.
- Tidak ada nilai secret di commit history baru.
- Build hanya memakai env yang dibutuhkan.
- Route admin yang memakai service role tetap memvalidasi user admin/owner lebih dulu.
