# Testing Layer

Status saat ini: baseline technical check sudah ada, tapi belum ada integration/e2e otomatis.

## Check yang wajib sebelum push

```bash
npm run verify
```

`verify` menjalankan:

- Direct-write audit untuk area frontend
- ESLint
- TypeScript typecheck
- Playwright E2E test discovery
- Next.js production build

## E2E minimal

```bash
npm run test:e2e
```

Default test menjalankan public smoke untuk halaman login. Authenticated smoke akan aktif bila env berikut tersedia:

```env
E2E_ADMIN_EMAIL=owner@example.com
E2E_ADMIN_PASSWORD=your-password
E2E_BASE_URL=http://127.0.0.1:3004
```

Jika `E2E_BASE_URL` kosong, Playwright akan menjalankan `npm run dev` otomatis.

## Manual smoke test wajib

Setelah deploy, cek alur berikut:

1. Login owner/admin.
2. Dashboard terbuka tanpa redirect aneh.
3. Product add/edit/toggle/delete sesuai role.
4. Stock add/edit/bulk upload/delete sesuai role.
5. Ticket status/reply/resolve mengirim pesan ke Telegram.
6. Balance add/deduct/remove hanya owner.
7. Voucher create/edit/toggle/delete.
8. Loyalty edit/toggle.
9. Backup manual critical dan full bisa membuat run history.
10. Halaman Log Audit mencatat aksi write.

## Target automated test

Tahap minimal yang direkomendasikan:

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | Helper validasi input, rate limit, audit payload redaction |
| Integration | Vitest + mocked Supabase | API admin route success/fail/owner-only |
| E2E | Playwright | Login, CRUD produk/stok, ticket reply, backup manual |
| Bot smoke | Deno test/manual webhook fixture | Menu order aktif, kalkulator refund, garansi/ticket |

## Prinsip test data

- Pakai test user khusus.
- Jangan pakai production customer asli untuk e2e.
- Jangan log secret.
- Setelah test write, hapus atau tandai data test dengan prefix `TEST_`.
