import { redirect } from "next/navigation";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseDate, toStatus } from "@/lib/util";

const MAX_ROWS = 5000;

async function readCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  const text = (await file.text()).replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return parsed.data.slice(0, MAX_ROWS);
}

async function importStudents(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  const rows = await readCsv(formData);
  if (!rows) redirect("/import?error=Choose%20a%20CSV%20file");

  let done = 0;
  let skipped = 0;
  const classCache = new Map<string, string>();
  const parentCache = new Map<string, string | null>();

  for (const r of rows) {
    const admissionNo = (r.admission_no ?? "").trim();
    const name = (r.name ?? "").trim();
    if (!admissionNo || !name) {
      skipped++;
      continue;
    }

    let classId: string | null = null;
    const className = (r.class ?? "").trim();
    const section = (r.section ?? "").trim();
    if (className) {
      const key = `${className}|${section}`;
      if (!classCache.has(key)) {
        const c = await db.class.upsert({
          where: { name_section: { name: className, section } },
          update: {},
          create: { name: className, section },
        });
        classCache.set(key, c.id);
      }
      classId = classCache.get(key)!;
    }

    let parentId: string | null | undefined;
    const parentEmail = (r.parent_email ?? "").trim().toLowerCase();
    if (parentEmail) {
      if (!parentCache.has(parentEmail)) {
        const p = await db.user.findFirst({ where: { email: parentEmail, role: "PARENT" } });
        parentCache.set(parentEmail, p?.id ?? null);
      }
      parentId = parentCache.get(parentEmail);
    }

    await db.student.upsert({
      where: { admissionNo },
      update: { name, classId, ...(parentId ? { parentId } : {}) },
      create: { admissionNo, name, classId, parentId: parentId ?? null },
    });
    done++;
  }
  redirect(`/import?ok=${encodeURIComponent(`Students: ${done} imported or updated, ${skipped} skipped`)}`);
}

async function importAttendance(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  const rows = await readCsv(formData);
  if (!rows) redirect("/import?error=Choose%20a%20CSV%20file");

  const students = await db.student.findMany({ select: { id: true, admissionNo: true } });
  const byAdm = new Map(students.map((s) => [s.admissionNo, s.id]));

  const ops = [];
  let skipped = 0;
  for (const r of rows) {
    const studentId = byAdm.get((r.admission_no ?? "").trim());
    const date = parseDate(r.date ?? "");
    const status = toStatus(r.status ?? "");
    if (!studentId || !date || !status) {
      skipped++;
      continue;
    }
    ops.push(
      db.attendance.upsert({
        where: { studentId_date: { studentId, date } },
        update: { status },
        create: { studentId, date, status },
      }),
    );
  }
  for (let i = 0; i < ops.length; i += 200) {
    await db.$transaction(ops.slice(i, i + 200));
  }
  redirect(`/import?ok=${encodeURIComponent(`Attendance: ${ops.length} records saved, ${skipped} skipped`)}`);
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole("ADMIN");
  const { ok, error } = await searchParams;

  return (
    <main>
      <h1>Import data</h1>
      {ok && <div className="notice ok">{ok}</div>}
      {error && <div className="notice err">{error}</div>}
      <p className="muted">
        Upload a .csv file. In Excel, use File → Save As → CSV (UTF-8). Existing records are updated,
        not duplicated. Up to {MAX_ROWS} rows per upload.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Students</h2>
        <p className="muted">
          Columns: <code>admission_no, name, class, section, parent_email</code>. Classes are created
          automatically. <code>parent_email</code> must match an existing parent on the Users page.
        </p>
        <form action={importStudents} className="row">
          <label>
            CSV file
            <input type="file" name="file" accept=".csv,text/csv" required />
          </label>
          <button>Import students</button>
          <a className="btn ghost" href="/api/export/students">
            Download current list
          </a>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Attendance</h2>
        <p className="muted">
          Columns: <code>admission_no, date, status</code>. Date is YYYY-MM-DD. Status is Present,
          Absent or Late (P, A, L also work). Students must be imported first.
        </p>
        <form action={importAttendance} className="row">
          <label>
            CSV file
            <input type="file" name="file" accept=".csv,text/csv" required />
          </label>
          <button>Import attendance</button>
        </form>
      </div>
    </main>
  );
}