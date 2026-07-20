# API Reference

Semua endpoint admin berjalan di Next.js route handler dan harus memvalidasi session Supabase user. Write action memakai service role server-side, rate limit, dan audit log bila endpoint sudah masuk hardening.

Base URL production:

```text
https://saisoku-insight-sales.vercel.app
```

Spesifikasi OpenAPI dasar tersedia di:

```text
docs/openapi-admin.json
```

## Auth

Admin panel:

- Client login memakai Supabase Auth email + password.
- API admin menerima session user dari Supabase token/cookie yang dikirim aplikasi.
- Role admin/owner dicek dari profile/table internal.

Cron backup:

- Endpoint cron harus membawa secret `BACKUP_CRON_SECRET`.

## Admin endpoints

| Method | Path | Fungsi | Catatan |
| --- | --- | --- | --- |
| `GET` | `/api/admin/audit` | List audit log | Admin/owner |
| `GET` | `/api/admin/backups` | List backup run | Admin/owner |
| `POST` | `/api/admin/backups` | Run manual backup | Rate limited, audit logged |
| `GET` | `/api/admin/balance` | Data balance/user | Admin/owner |
| `POST` | `/api/admin/balance` | Add/deduct/remove balance | Owner only untuk write saldo |
| `GET` | `/api/admin/loyalty` | List loyalty config | Admin/owner |
| `POST` | `/api/admin/loyalty` | Create loyalty config | Rate limited |
| `PATCH` | `/api/admin/loyalty` | Update/toggle loyalty config | Rate limited |
| `POST` | `/api/admin/products` | Create product | Rate limited |
| `PATCH` | `/api/admin/products` | Update/toggle product | Rate limited |
| `DELETE` | `/api/admin/products` | Delete product | Owner only |
| `POST` | `/api/admin/stocks` | Create/bulk upload stock | Rate limited |
| `PATCH` | `/api/admin/stocks` | Update/toggle stock | Rate limited |
| `DELETE` | `/api/admin/stocks` | Delete stock | Owner only |
| `PATCH` | `/api/admin/users` | Update user role/status | Owner only untuk role tinggi/delete |
| `GET` | `/api/admin/vouchers` | List voucher | Admin/owner |
| `POST` | `/api/admin/vouchers` | Create voucher | Rate limited |
| `PATCH` | `/api/admin/vouchers` | Update/toggle voucher | Rate limited |
| `DELETE` | `/api/admin/vouchers` | Delete voucher | Rate limited |

## Ticket endpoints

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/tickets/file` | Proxy file Telegram untuk panel |
| `POST` | `/api/tickets/reply` | Kirim reply admin ke user Telegram |
| `POST` | `/api/tickets/resolve` | Resolve ticket dan kirim notifikasi |
| `POST` | `/api/tickets/status` | Ubah status ticket: Assigned, On Progress, Resolved |

## Backup endpoints

| Method | Path | Trigger |
| --- | --- | --- |
| `POST` | `/api/admin/backups` | Manual dari Settings > Backup |
| `GET` | `/api/admin/backups?mode=critical` | Vercel cron critical, wajib `Authorization: Bearer BACKUP_CRON_SECRET` |
| `GET` | `/api/admin/backups?mode=full` | Vercel cron full, wajib `Authorization: Bearer BACKUP_CRON_SECRET` |

## Bot integration

Supabase Edge Function:

```text
telegram-bot
```

Fungsi utama:

- Webhook Telegram.
- Menu order aktif.
- Kalkulator refund.
- Ticket garansi.
- Admin notification/reply bridge.

Deploy:

```bash
supabase functions deploy telegram-bot --no-verify-jwt
```

## Response convention

Endpoint admin sebaiknya mengembalikan JSON:

```json
{
  "ok": true,
  "data": {}
}
```

Error umum:

```json
{
  "error": "Pesan error singkat"
}
```

Jangan mengembalikan secret, raw stack trace, atau credential account produk ke client.
