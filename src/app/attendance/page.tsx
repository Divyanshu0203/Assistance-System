import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, classScope } from "@/lib/auth";
import { classLabel, parseDate, todayStr, toStatus, fmtDate } from "@/lib/util";

async function saveAttendance(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN", "TEACHER");
  const classId = String(formData.get("classId") ?? "");
  const dateStr = String(formData.get("date") ?? "");
  const date = parseDate(dateStr);
  if (!classId || !date) redirect("/attendance");

  const cls = await db.class.findFirst({
    where: { id: classId, ...classScope(session) },
    include: { students: { select: { id: true } } },
  });
  if (!cls) redirect("/attendance");

  const ops = [];
  for (const s of cls.students) {
    const status = toStatus(String(formData.get(`status_${s.id}`) ?? ""));
    if (!status) continue;
    ops.push(
      db.attendance.upsert({
        where: { studentId_date: { studentId: s.id, date } },
        update: { status },
        create: { studentId: s.id, date, status },
      }),
    );
  }
  await db.$transaction(ops);
  redirect(`/attendance?classId=${classId}&date=${dateStr}&saved=${ops.length}`);
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string; saved?: string }>;
}) {
  const session = await requireRole("ADMIN", "TEACHER");
  const sp = await searchParams;
  const dateStr = parseDate(sp.date ?? "") ? (sp.date as string) : todayStr();

  const classes = await db.class.findMany({
    where: classScope(session),
    orderBy: [{ name: "asc" }, { section: "asc" }],
  });
  const selected = classes.find((c) => c.id === sp.classId) ?? null;

  const students = selected
    ? await db.student.findMany({
        where: { classId: selected.id },
        orderBy: { name: "asc" },
        include: { attendance: { where: { date: parseDate(dateStr)! } } },
      })
    : [];

  return (
    <main>
      <h1>Mark attendance</h1>
      {sp.saved && <div className="notice ok">Saved attendance for {sp.saved} student(s).</div>}

      <div className="card">
        <form method="get" className="row">
          <label>
            Class
            <select name="classId" defaultValue={selected?.id ?? ""} required>
              <option value="" disabled>
                Choose a class
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" name="date" defaultValue={dateStr} max={todayStr()} />
          </label>
          <button>Load</button>
        </form>
        {classes.length === 0 && (
          <p className="muted">No classes are assigned to you yet. Ask an admin to assign one.</p>
        )}
      </div>

      {selected && (
        <form action={saveAttendance} className="card">
          <input type="hidden" name="classId" value={selected.id} />
          <input type="hidden" name="date" value={dateStr} />
          <h2 style={{ marginTop: 0 }}>
            {classLabel(selected)} · {dateStr}
          </h2>
          <table>
            <thead>
              <tr>
                <th>Adm. no.</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const current = s.attendance[0]?.status ?? "PRESENT";
                return (
                  <tr key={s.id}>
                    <td>{s.admissionNo}</td>
                    <td>{s.name}</td>
                    <td>
                      <div className="seg">
                        {(["PRESENT", "ABSENT", "LATE"] as const).map((st) => (
                          <label key={st}>
                            <input
                              type="radio"
                              name={`status_${s.id}`}
                              value={st}
                              defaultChecked={current === st}
                            />
                            {st.charAt(0) + st.slice(1).toLowerCase()}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No students in this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {students.length > 0 && (
            <p>
              <button>Save attendance</button>{" "}
              <span className="muted">
                Students not yet marked for {fmtDate(parseDate(dateStr))} default to Present.
              </span>
            </p>
          )}
        </form>
      )}
    </main>
  );
}