export function exportToCSV(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const header = keys.join(',')
  const body = rows.map(row =>
    keys.map(k => {
      const v = row[k] ?? ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(',')
  ).join('\n')
  const csv = `${header}\n${body}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
