/** Build a CSV string that opens cleanly in Excel (UTF-8 BOM) and is safe from formula injection. */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Stop spreadsheet apps from treating text as a formula.
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(cell).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Month string "YYYY-MM" to [start, nextMonthStart) in UTC. */
export function monthRange(month: string): { from: Date; to: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const from = new Date(month + "-01T00:00:00.000Z");
  if (Number.isNaN(from.getTime())) return null;
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return { from, to };
}