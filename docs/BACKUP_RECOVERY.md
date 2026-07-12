# SAISOKU Backup & Recovery

This kit separates backup into two tracks:

1. System backup: source code snapshots, migrations, and recovery notes.
2. Data backup: Supabase table exports to JSON.

Secrets are never committed to Git.

## Files

- `.env.backup.example`: template for local backup credentials.
- `scripts/backup-data.mjs`: exports Supabase data to JSON.
- `scripts/backup-system.ps1`: creates ZIP snapshots from Git HEAD.

## Required Local Secret File

Create `.env.backup.local` in `saisoku-insight-sales`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SAISOKU_BACKUP_DIR=C:\SAISOKU_BACKUPS\data
```

Do not commit `.env.backup.local`.

## Data Backup

### Web Panel Backup

Manual backup is available in:

```text
Dashboard > Settings > Backup
```

Owner can run:

- Critical backup
- Full backup

The generated backup is stored in Supabase Storage private bucket:

```text
saisoku-backups
```

Backup history is stored in:

```text
backup_runs
```

### Auto Backup

`vercel.json` schedules are limited by Vercel Hobby rules:

- Critical backup: daily at `17:10 UTC` / `00:10 WIB`
- Full backup: weekly Sunday at `17:20 UTC` / Monday `00:20 WIB`

For hourly critical backup, use Windows Task Scheduler or GitHub Actions with repository secrets.

Required Vercel env:

```env
BACKUP_CRON_SECRET=use-a-long-random-secret
SAISOKU_BACKUP_BUCKET=saisoku-backups
```

Vercel Cron calls `/api/admin/backups?mode=critical` or `/api/admin/backups?mode=full`.
The API only accepts cron runs when the request contains `Authorization: Bearer BACKUP_CRON_SECRET`.

### Local Script Backup

Critical backup, suitable for hourly runs:

```powershell
npm run backup:data:critical
```

Full backup, suitable for daily runs:

```powershell
npm run backup:data:full
```

Default output:

```text
..\SAISOKU_BACKUPS\data\YYYY-MM-DD_HH-mm-ss\
  manifest.json
  users.json
  transactions.json
  balance_logs.json
  ...
```

## System Backup

Run from `saisoku-insight-sales`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-system.ps1
```

Default output:

```text
..\SAISOKU_BACKUPS\system\YYYY-MM-DD_HH-mm-ss\
  saisoku-insight-sales.zip
  saisoku-bot-sales.zip
  commits.txt
```

## Recommended Schedule

- Critical data backup: every 1 hour.
- Full data backup: daily at 00:10.
- System backup: after every major deploy or daily.
- Keep a second copy in Google Drive or another private cloud location.

## Windows Task Scheduler

Create three tasks:

Critical data hourly:

```powershell
Program: powershell.exe
Arguments: -NoProfile -ExecutionPolicy Bypass -Command "cd 'C:\Users\itsup\OneDrive\Documents\SAISOKU ID\BOT\PROJECT SAISOKU\saisoku-insight-sales'; npm run backup:data:critical"
```

Full data daily:

```powershell
Program: powershell.exe
Arguments: -NoProfile -ExecutionPolicy Bypass -Command "cd 'C:\Users\itsup\OneDrive\Documents\SAISOKU ID\BOT\PROJECT SAISOKU\saisoku-insight-sales'; npm run backup:data:full"
```

System backup daily:

```powershell
Program: powershell.exe
Arguments: -NoProfile -ExecutionPolicy Bypass -Command "cd 'C:\Users\itsup\OneDrive\Documents\SAISOKU ID\BOT\PROJECT SAISOKU\saisoku-insight-sales'; powershell -ExecutionPolicy Bypass -File scripts\backup-system.ps1"
```

## Recovery Order

If hacked or broken:

1. Rotate secrets: Telegram bot token, Supabase service role key, Vercel env.
2. Stop or rollback bad Vercel deployment.
3. Redeploy bot from the last known good commit.
4. Restore data from the newest clean backup.
5. Compare balance and transaction logs after the incident time.

## Notes

JSON backups are practical for development and emergency inspection. For production-grade database restore, add `pg_dump` or Supabase point-in-time recovery when available.
