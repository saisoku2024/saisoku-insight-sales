# Direct Write Audit

Tujuan: mencegah frontend/browser melakukan write langsung ke Supabase setelah RLS/public grants dikunci.

Script:

```bash
npm run audit:direct-write
```

Yang diperiksa:

- `app/dashboard`
- `components`
- `lib`

Pattern yang diblokir di area frontend:

- `.insert(`
- `.update(`
- `.delete(`
- `.upsert(`
- `.rpc(`

Jika butuh write, pindahkan action ke route server-side `/api/admin/*`, validasi admin/owner, gunakan service role server-side, rate limit, dan audit log.
