# SAISOKU Availability & Recovery Runbook

Dokumen ini adalah SOP saat web panel, bot, atau data SAISOKU bermasalah. Jangan simpan secret/token di dokumen ini.

## Target Operasional

- RPO critical data: maksimal kehilangan data mengikuti backup critical terakhir.
- RPO full data: maksimal kehilangan data mengikuti backup full terakhir.
- RTO web panel: target pulih 15-30 menit lewat rollback Vercel.
- RTO bot Telegram: target pulih 15-30 menit lewat deploy commit bot terakhir yang sehat.
- RTO data incident: tergantung ukuran data dan validasi restore.

## Health Checklist Setelah Deploy

Jalankan checklist ini setelah deploy web, deploy bot, restore data, atau rotasi secret.

1. Login web panel sebagai owner.
2. Buka Dashboard dan pastikan KPI tampil.
3. Buka Products dan Stocks, pastikan data muncul.
4. Buka Users dan Balance, pastikan row tampil dan pagination jalan.
5. Buka Tickets, pastikan history/reply tampil.
6. Buka Settings > Backup, pastikan backup runs tampil.
7. Kirim command bot Telegram, pastikan menu utama muncul.
8. Tes flow kecil yang aman: cek order aktif / kalkulator / ticket tanpa transaksi real bila memungkinkan.

## Web Panel Rollback

Gunakan saat web panel error setelah deploy.

1. Buka Vercel project `saisoku-insight-sales`.
2. Masuk tab Deployments.
3. Pilih deployment terakhir yang sehat.
4. Klik Promote to Production.
5. Jalankan Health Checklist.
6. Catat incident: waktu, commit bermasalah, commit sehat, impact, tindakan.

Alternatif lewat Git:

```powershell
git log --oneline -10
git revert <bad_commit>
git push origin main
```

Gunakan `git revert`, bukan `git reset --hard`, agar histori tetap aman.

## Bot Telegram Rollback

Gunakan saat bot Telegram error setelah deploy Supabase Edge Function.

1. Buka folder `saisoku-bot-sales`.
2. Cari commit bot terakhir yang sehat:

```powershell
git log --oneline -10
```

3. Buat revert commit jika commit terbaru bermasalah:

```powershell
git revert <bad_commit>
```

4. Deploy ulang Edge Function:

```powershell
supabase functions deploy telegram-bot --no-verify-jwt
```

5. Tes command bot Telegram.
6. Catat incident.

## Data Recovery Decision Tree

Gunakan ini sebelum restore data.

1. Jika data hanya salah di beberapa row:
   - Jangan restore full.
   - Ambil file backup JSON sebagai referensi.
   - Patch row spesifik via SQL/RPC/manual admin tool.

2. Jika tabel tertentu corrupt:
   - Restore hanya tabel terdampak dari backup bersih.
   - Validasi relasi transaksi, balance, stock, ticket.

3. Jika banyak tabel corrupt setelah attack/error besar:
   - Freeze write action sementara.
   - Rotate secret.
   - Rollback web/bot bila perlu.
   - Restore dari backup bersih terbaru.
   - Jalankan Health Checklist.

## Data Restore SOP

Restore data adalah tindakan sensitif. Jalankan hanya oleh owner.

1. Tentukan waktu incident.
2. Pilih backup terakhir sebelum incident:
   - Supabase Storage bucket `saisoku-backups`
   - Folder `critical/...json.gz` atau `full/...json.gz`
3. Download backup dan manifest.
4. Validasi manifest:
   - mode
   - created_at
   - rows_count
   - tables_count
   - error kosong
5. Buat backup baru sebelum restore agar ada snapshot kondisi rusak.
6. Restore tabel terdampak secara terbatas.
7. Validasi:
   - balance user penting
   - transaksi paid
   - product_accounts available/sold
   - tickets/ticket_replies
   - voucher_claims/balance_logs
8. Jalankan Health Checklist.
9. Catat incident dan file backup yang dipakai.

## Incident Log Template

```text
Tanggal/Waktu:
Pelapor:
Area terdampak: web / bot / database / storage / auth
Gejala:
Impact:
Waktu mulai:
Waktu selesai:
Root cause:
Commit/deployment bermasalah:
Backup yang dipakai:
Tindakan:
Validasi setelah recovery:
Follow-up:
```

## Minimum Recovery Artifacts

- GitHub repo web dan bot dalam kondisi terbaru.
- Supabase migrations tersimpan di repo.
- Backup data tersedia di Supabase Storage.
- Vercel deployment history tersedia.
- Catatan commit/deploy bot terakhir yang sehat.
- Env secret hanya berada di Vercel/Supabase/local private file.
