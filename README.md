# Saisoku Admin Dashboard

Dashboard admin untuk reporting penjualan, pengelolaan stock account, transaksi, dan user management berbasis Next.js + Supabase.

## Improvement yang sudah diterapkan

- Login page dibuat lebih profesional dan siap dipakai untuk admin internal.
- Layout dashboard dirapikan dengan sidebar responsif, topbar, grouping menu, dan auth guard.
- Struktur kode dipisah ke komponen reusable dan folder domain standar (`components`, `config`, `features`, `services`, `schemas`, `providers`, `store`, `styles`).
- File backup / file sampah yang tidak terpakai dibersihkan.
- Root route diarahkan ke login, lalu redirect otomatis ke dashboard jika sesi masih aktif.

## Struktur utama

```bash
app/
  api/
  auth/
  dashboard/
  login/
components/
  auth/
  dashboard/
  shared/
  ui/
config/
  navigation.ts
features/
hooks/
lib/
  supabase/
providers/
repositories/
schemas/
services/
  admin/
  auth/
store/
styles/
types/
```

Prinsip struktur:

- `app/` hanya untuk route Next.js, layout, dan route handler API.
- `components/` untuk UI reusable lintas fitur.
- `features/` untuk logic/komponen domain ketika page mulai besar.
- `config/` untuk konfigurasi statis seperti navigation/routes.
- `services/` untuk client/server service dan helper API.
- `schemas/` untuk validasi payload sebelum fitur write/action dibuka.
- `styles/` untuk global CSS dan style asset bersama.

## Menjalankan project

```bash
npm install
npm run dev
```

Lalu buka `http://localhost:3000`.

## Environment

Buat file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

`SUPABASE_SERVICE_ROLE_KEY` dan `TELEGRAM_BOT_TOKEN` hanya dipakai server-side untuk fitur admin seperti reply/resolve ticket. Jangan expose dua env ini dengan prefix `NEXT_PUBLIC_`.

## Catatan lanjutan

Catatan audit 11 Juli 2026:

- `saisoku-insight-sales` diarahkan sebagai source utama admin panel Next.js.
- Folder root `New Web Panel` dipertahankan sebagai referensi/mockup HTML lama, bukan target runtime utama.
- Sesuai migration security saat ini, akses frontend Supabase untuk role `authenticated` bersifat read-only. Fitur tulis admin berikutnya sebaiknya lewat server-side API/RPC yang tervalidasi.
- Struktur folder admin panel sudah diarahkan ke feature-based architecture agar page besar bisa dipisah bertahap tanpa merusak route.

## Dokumen operasional

- `docs/AVAILABILITY_RECOVERY.md`: health check, incident response, dan recovery.
- `docs/BACKUP_RECOVERY.md`: strategi backup data.
- `docs/RLS_PUBLIC_GRANT_REVIEW.md`: review RLS dan public write grant.
- `docs/SECRETS_MANAGEMENT.md`: registry secret dan SOP rotasi.
- `docs/ERROR_TRACKING.md`: standar log dan target central error tracking.
- `docs/ERROR_LOG_AUDIT.md`: coverage audit jalur error web, bot, dan Better Stack.
- `docs/TESTING_LAYER.md`: baseline verify dan target integration/e2e.
- `docs/RESTORE_TOOLING.md`: desain restore aman.
- `docs/API_REFERENCE.md`: endpoint admin, ticket, backup, dan bot.
- `docs/openapi-admin.json`: spesifikasi OpenAPI dasar.
- `docs/DIRECT_WRITE_AUDIT.md`: audit frontend agar tidak write langsung ke Supabase.

Tahap berikut yang disarankan:

1. Pecah halaman `products`, `stocks`, `transactions`, dan `users` ke folder `features/*`.
2. Tambahkan schema validasi untuk payload write admin di `schemas/`.
3. Rapikan type data Supabase agar penggunaan `any` bisa dikurangi.
