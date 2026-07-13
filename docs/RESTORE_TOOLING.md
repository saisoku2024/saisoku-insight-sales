# Restore Tooling

Status saat ini: backup manual dan auto backup sudah tersedia. Restore aman tersedia sebagai `Preview Restore`, `Append Restore`, dan `Safe Replace` owner-only. Full replace tetap manual/emergency karena risiko overwrite data aktif sangat tinggi.

## Prinsip restore

- Restore hanya boleh dilakukan owner.
- Restore tidak boleh otomatis menimpa data tanpa preview.
- Sistem wajib membuat backup baru sebelum restore.
- Semua restore wajib masuk `admin_audit_logs`.
- Restore harus bisa dry-run lebih dulu.

## Flow tombol restore yang tersedia

1. Owner buka Settings > Backup.
2. Owner pilih backup run dari daftar.
3. Klik `Preview`.
4. Server membaca manifest backup dan menampilkan:
   - mode backup
   - timestamp
   - tabel tersedia
   - jumlah row per tabel
   - estimasi tabel yang akan terdampak
5. Owner pilih tabel yang ingin direstore lewat daftar comma-separated.
6. Owner mengetik confirmation phrase: `RESTORE SAISOKU` untuk append atau `REPLACE SAISOKU` untuk safe replace.
7. Server membuat pre-restore backup.
8. Server menjalankan append/upsert atau safe replace per primary key dalam batch.
9. Server mencatat hasil restore ke audit log.

## Mode restore yang direkomendasikan

| Mode | Fungsi | Risiko |
| --- | --- | --- |
| Dry-run | Validasi file dan tampilkan dampak | Rendah |
| Table append | Upsert data dari backup tanpa truncate tabel aktif | Sedang |
| Safe replace | Hapus row dengan primary key yang ada di backup, lalu upsert row backup | Sedang-Tinggi |
| Table replace penuh | Ganti isi tabel terpilih dengan truncate/delete all | Tinggi |
| Full replace | Ganti banyak tabel sekaligus | Sangat tinggi, hanya emergency |

## Yang belum boleh dibuat sembarangan

- Tombol `Full Restore` satu klik.
- Restore otomatis dari cron.
- Restore tanpa confirmation phrase.
- Restore memakai backup yang tidak lolos validasi schema.
- Full replace/truncate restore dari web panel tanpa review manual.

## Emergency manual restore

Jika production rusak berat:

1. Freeze write sementara jika memungkinkan.
2. Ambil backup terbaru yang valid.
3. Buat backup kondisi rusak saat ini untuk forensik.
4. Restore tabel paling penting lebih dulu: `users`, `products`, `product_accounts`, `transactions`, `balance_logs`, `tickets`, `ticket_replies`.
5. Jalankan smoke test.
6. Buka kembali write.
