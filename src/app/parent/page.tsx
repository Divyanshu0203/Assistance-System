import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { classLabel, fmtDate, money } from "@/lib/util";

export default async function ParentPage() {
  const session = await requireRole("PARENT");

  // Only this parent's own children are ever queried. Everything here is read-only.
  const children = await db.student.findMany({
    where: { parentId: session.uid },
    orderBy: { name: "asc" },
    include: {
      class: true,
      marks: { orderBy: [{ exam: "asc" }, { subject: "asc" }] },
      fees: { orderBy: { dueDate: "asc" } },
      attendance: { orderBy: { date: "desc" }, take: 30 },
    },
  });

  const totals = await db.attendance.groupBy({
    by: ["studentId", "status"],
    where: { studentId: { in: children.map((c) => c.id) } },
    _count: { _all: true },
  });

  return (
    <main>
      <h1>My children</h1>
      <p className="muted">This page is view-only. Contact the school office to correct any record.</p>

      {children.length === 0 && (
        <div className="card">No students are linked to your account yet. Please contact the school office.</div>
      )}

      {children.map((child) => {
        const count = (status: string) =>
          totals.find((t) => t.studentId === child.id && t.status === status)?._count._all ?? 0;
        const present = count("PRESENT");
        const late = count("LATE");
        const absent = count("ABSENT");
        const days = present + late + absent;
        const pct = days ? Math.round(((present + late) / days) * 100) : null;
        const due = child.fees.reduce((sum, f) => sum + (f.amount - f.paid), 0);

        return (
          <section key={child.id} className="card">
            <h2 style={{ marginTop: 0 }}>
              {child.name} <span className="pill">{classLabel(child.class)}</span>
            </h2>
            <p className="muted">Admission no. {child.admissionNo}</p>

            <h2>Attendance</h2>
            <p>
              {pct === null ? (
                "No attendance recorded yet."
              ) : (
                <>
                  <strong>{pct}%</strong> attended ({present} present, {late} late, {absent} absent over{" "}
                  {days} days)
                </>
              )}
            </p>
            {child.attendance.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Date (last 30 records)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {child.attendance.map((a) => (
                    <tr key={a.id}>
                      <td>{fmtDate(a.date)}</td>
                      <td>{a.status.charAt(0) + a.status.slice(1).toLowerCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>Marks</h2>
            {child.marks.length === 0 ? (
              <p className="muted">No marks published yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Subject</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {child.marks.map((m) => (
                    <tr key={m.id}>
                      <td>{m.exam}</td>
                      <td>{m.subject}</td>
                      <td>
                        {m.score} / {m.maxScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>Fees</h2>
            {child.fees.length === 0 ? (
              <p className="muted">No fee records.</p>
            ) : (
              <>
                <p>
                  <strong>Outstanding: {money(due)}</strong>
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Fee</th>
                      <th>Due</th>
                      <th>Amount</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {child.fees.map((f) => (
                      <tr key={f.id}>
                        <td>{f.title}</td>
                        <td>{fmtDate(f.dueDate) || "-"}</td>
                        <td>{money(f.amount)}</td>
                        <td>{money(f.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        );
      })}
    </main>
  );
}