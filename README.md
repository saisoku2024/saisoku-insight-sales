# Saisoku Admin Dashboard

Dashboard admin untuk reporting penjualan, pengelolaan stock account, transaksi, dan user management berbasis Next.js + Supabase.

## Improvement yang sudah diterapkan

- Login page dibuat lebih profesional dan siap dipakai untuk admin internal.
- Layout dashboard dirapikan dengan sidebar responsif, topbar, grouping menu, dan auth guard.
- Struktur kode dipisah ke komponen reusable (`components/auth`, `components/dashboard`, `components/brand`).
- File backup / file sampah yang tidak terpakai dibersihkan.
- Root route diarahkan ke login, lalu redirect otomatis ke dashboard jika sesi masih aktif.

## Struktur utama

```bash
app/
  dashboard/
  login/
components/
  auth/
  brand/
  dashboard/
lib/
  navigation.ts
  supabaseClient.ts
```

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

Tahap berikut yang disarankan:

1. Refactor halaman `products`, `stocks`, `transactions`, dan `users` ke komponen reusable supaya style benar-benar konsisten.
2. Tambahkan server-side route protection / middleware jika nanti ingin harden auth lebih jauh.
3. Rapikan type data Supabase agar penggunaan `any` bisa dikurangi.
