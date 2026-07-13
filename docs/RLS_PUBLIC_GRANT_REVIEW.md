# RLS / Public Grant Review

Tanggal review: 13 Juli 2026

Tujuan: memastikan role `anon` dan `authenticated` tidak bisa melakukan write langsung ke tabel penting dari frontend/browser. Semua write admin harus lewat Next.js API server-side atau Supabase Edge Function yang memakai validasi admin dan service role.

## Status hardening

Migration database:

- `saisoku-bot-sales/supabase/migrations/202607130003_harden_public_write_grants.sql`

Yang dilakukan migration:

- Mengaktifkan RLS untuk tabel penting jika tabelnya ada.
- Mencabut privilege `insert`, `update`, dan `delete` dari role `anon`.
- Mencabut privilege `insert`, `update`, dan `delete` dari role `authenticated`.
- Menjaga role `service_role` tetap punya akses penuh untuk API server-side dan bot.

## Tabel yang dikunci dari public write

| Tabel | Public write | Write resmi |
| --- | --- | --- |
| `users` | Ditolak | Next.js admin API |
| `products` | Ditolak | Next.js admin API |
| `product_accounts` | Ditolak | Next.js admin API |
| `transactions` | Ditolak | Bot Edge Function / admin API |
| `balance_logs` | Ditolak | Next.js admin API / bot flow |
| `vouchers` | Ditolak | Next.js admin API |
| `tickets` | Ditolak | Bot Edge Function / admin API |
| `ticket_replies` | Ditolak | Next.js admin API |
| `admin_audit_logs` | Ditolak | Server-side audit helper |
| `api_rate_limits` | Ditolak | Server-side rate limit helper |
| `error_logs` | Ditolak | Server-side error log helper |

## Query verifikasi

Jalankan di Supabase SQL Editor setelah migration:

```sql
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'users',
    'products',
    'product_accounts',
    'transactions',
    'balance_logs',
    'vouchers',
    'tickets',
    'ticket_replies',
    'admin_audit_logs',
    'api_rate_limits'
  )
order by table_name, grantee, privilege_type;
```

Expected:

- `anon` dan `authenticated` tidak punya `INSERT`, `UPDATE`, atau `DELETE` untuk tabel di atas.
- `service_role` tetap punya privilege penuh.

## Catatan operasional

- Kalau ada halaman frontend lama yang masih memanggil `.insert()`, `.update()`, atau `.delete()` langsung memakai Supabase browser client, action tersebut akan gagal setelah hardening ini. Itu perilaku yang diinginkan.
- Perbaikan untuk write yang gagal adalah pindahkan action ke route `/api/admin/*`, validasi role admin/owner, lalu pakai service client server-side.
- Jangan membuat policy RLS write untuk `anon` atau `authenticated` pada tabel produksi tanpa review.
