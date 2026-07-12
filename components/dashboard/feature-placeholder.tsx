type FeaturePlaceholderProps = {
  badge: string
  title: string
  description: string
  features: string[]
  columns?: string[]
  rows?: string[][]
  note?: string
}

export function FeaturePlaceholder({
  badge,
  title,
  description,
  features,
  columns = [],
  rows = [],
  note = "Tahap awal: struktur halaman sudah disiapkan mengikuti web mockup. Integrasi data real Supabase/bot dikerjakan per modul berikutnya.",
}: FeaturePlaceholderProps) {
  return (
    <div className="space-y-4 text-[var(--insight-text)]">
      <div className="insight-card p-3">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-2.5 py-1 text-base leading-none text-violet-800">
          {badge}
        </span>
        <h1 className="mt-2 text-[28px] leading-none text-[var(--insight-text)]">
          {title}
        </h1>
        <p className="mt-1 text-lg leading-none text-[var(--insight-muted)]">
          {description}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature}
            className="insight-card min-h-[86px] p-3 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="text-lg leading-none text-[var(--insight-muted)]">
              Module
            </div>
            <div className="mt-2 text-2xl leading-none text-[var(--insight-text)]">
              {feature}
            </div>
          </div>
        ))}
      </div>

      {columns.length > 0 ? (
        <div className="insight-card overflow-hidden">
          <div className="border-b-[3px] border-[var(--insight-border)] p-3">
            <span className="inline-block border-[3px] border-[var(--insight-border)] bg-cyan-100 px-2.5 py-1 text-base leading-none text-cyan-800">
              PREVIEW
            </span>
            <h2 className="mt-2 text-[26px] leading-none text-[var(--insight-text)]">
              Struktur Data
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="p-3 text-left">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.join("-")}
                    className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60"
                  >
                    {row.map((cell, index) => (
                      <td key={`${cell}-${index}`} className="p-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="p-6 text-center text-lg text-[var(--insight-muted)]"
                    >
                      Belum ada data preview.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="insight-card border-yellow-500 bg-yellow-50 p-3 text-yellow-900 dark:bg-yellow-500/10 dark:text-yellow-100">
        <div className="text-xl leading-none">Catatan Implementasi</div>
        <p className="mt-1.5 text-lg leading-tight">{note}</p>
      </div>
    </div>
  )
}
