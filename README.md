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

## Riwayat Update

Tracking ringkas dari pengembangan awal sampai versi terbaru:

| Tanggal | Commit | Update |
| --- | --- | --- |
| 11 Juli 2026 | `fb52ade` | Sidebar dashboard diselaraskan dengan susunan final mockup web panel. |
| 11 Juli 2026 | `4595e31` | Page read-only Supabase mulai dihubungkan ke data asli: balance, pricing, loyalty, vouchers, dan log balance. |
| 11 Juli 2026 | `ff8c667` | Dashboard dikunci menjadi admin-only melalui RPC/profile admin aktif. |
| 11 Juli 2026 | `1a11ed7` | Pagination ditambahkan untuk dashboard read views agar tabel lebih nyaman dipakai. |
| 11 Juli 2026 | `ac9762c` | Ticket status actions ditambahkan untuk flow operasional admin. |
| 11 Juli 2026 | `78bb462` | Loyalty tier management diaktifkan lewat API admin server-side. |
| 16 Juli 2026 | `de0f44e` | Struktur project dirapikan ke folder standar: `config`, `features`, `services`, `schemas`, `providers`, `store`, dan `styles`. |
| 20 Juli 2026 | `65b2ec9` | Login page ditambahkan shortcut `Login as Guest` untuk demo mode viewer. |

## Ringkasan Update 20 Juli 2026

Update besar yang sudah diterapkan hari ini:

- Login web panel ditambah opsi `Login as Guest`, mengisi kredensial demo otomatis lalu tetap masuk lewat tombol `Sign in to dashboard`.
- Guest/viewer mode dipertahankan sebagai akses demo yang bisa melihat dashboard tanpa akses edit/write.
- Page stock mendukung upload stock dari file CSV/TXT headerless dengan format `email;password;profile;pin`.
- Stock management ditambah filter product/brand/status dan flow delete bulk dengan konfirmasi.
- Transaction history sudah memakai snapshot akun dari `sold_accounts.account_snapshot`, sehingga riwayat tetap terbaca walau stock/account asli dihapus.
- Backup dan guarded reset history tersedia dari Settings > Backup untuk membersihkan data dummy transaksi/tiket secara lebih aman.
- Access log, audit log, error log, dan Better Stack logging sudah disiapkan untuk observability dasar.
- Bot Telegram diperbarui dengan promo aktif, harga promo tunggal tanpa stacking loyalty, output bulk purchase sebagai TXT, template start baru, serta style button inline.
- Bot dan web panel sudah tersambung ke GitHub untuk version control dan deployment: web via Vercel, bot via Supabase Edge Functions.

## Template Publikasi LinkedIn

```text
Sharing my latest project: SAISOKU INSIGHT

Halo rekan-rekan LinkedIn,

Saya baru menyelesaikan tahap pengembangan awal untuk proyek pribadi saya: SAISOKU INSIGHT
https://lnkd.in/ggG2Qu_J

SAISOKU INSIGHT adalah dashboard web yang saya bangun untuk membantu monitoring data penjualan, stok, user, tiket bantuan, voucher, loyalty, balance, backup data, audit log, dan access log dalam satu panel.

Tujuan saya membagikan proyek ini adalah untuk mendokumentasikan proses belajar sekaligus menguji bagaimana sistem dashboard internal dapat membantu operasional berjalan lebih rapi dan efisien.

Tech Stack yang digunakan:
- Frontend: Next.js, React, Tailwind CSS
- Backend/API: Next.js API Routes / Server-side logic
- Database & Auth: Supabase PostgreSQL, Supabase Auth, RLS
- Bot Integration: Telegram Bot via Supabase Edge Functions
- Storage & Backup: Supabase Storage
- Deployment: Vercel untuk web dashboard, Supabase untuk bot
- Version Control: GitHub
- Observability: Better Stack untuk logging
- Security Layer: Role-based access, viewer mode, audit log, access log, rate limiting, dan security headers

Saat ini project masih dalam tahap pengembangan dan pengujian pribadi. Jika teman-teman memiliki waktu luang, silakan coba akses aplikasinya. Saya sangat terbuka untuk masukan, kritik, maupun saran, terutama terkait pengalaman login, navigasi dashboard, tampilan data, atau flow penggunaan fitur.

Feedback teman-teman akan sangat membantu untuk pengembangan fitur berikutnya.

Terima kasih banyak!

#ProjectShowcase #WebDevelopment #NextJS #ReactJS #Supabase #Vercel #TelegramBot #CodingPortfolio #SaisokuInsight #LearningJourney #BuildInPublic
```

Catatan tracking:

- File ini menjadi catatan utama progress web panel.
- Setiap milestone besar berikutnya wajib menambahkan baris baru di bagian Riwayat Update.
- Perubahan schema/RLS/RPC Supabase tetap dicatat di migration repo bot, lalu diringkas di README ini bila berdampak ke web panel.

Tahap berikut yang disarankan:

1. Pecah halaman `products`, `stocks`, `transactions`, dan `users` ke folder `features/*`.
2. Tambahkan schema validasi untuk payload write admin di `schemas/`.
3. Rapikan type data Supabase agar penggunaan `any` bisa dikurangi.
