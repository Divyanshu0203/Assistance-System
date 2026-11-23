export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Parse "YYYY-MM-DD" into a UTC-midnight Date, or null if invalid. */
export function parseDate(value: string): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00.000Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function classLabel(c: { name: string; section: string } | null | undefined) {
  if (!c) return "-";
  return c.section ? `${c.name}-${c.section}` : c.name;
}

export function money(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export const STATUSES = ["PRESENT", "ABSENT", "LATE"] as const;
export type Status = (typeof STATUSES)[number];

export function toStatus(value: string): Status | null {
  const v = value.trim().toUpperCase();
  const map: Record<string, Status> = { P: "PRESENT", A: "ABSENT", L: "LATE" };
  const s = map[v] ?? v;
  return (STATUSES as readonly string[]).includes(s) ? (s as Status) : null;
}