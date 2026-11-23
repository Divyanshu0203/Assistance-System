import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, classScope } from "@/lib/auth";
import { classLabel } from "@/lib/util";

async function addMark(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN", "TEACHER");
  const studentId = String(formData.get("studentId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const exam = String(formData.get("exam") ?? "").trim();
  const score = Number(formData.get("score"));
  const maxScore = Number(formData.get("maxScore") || 100);
  if (!studentId || !subject || !exam) return;
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) return;

  const allowed = await db.student.findFirst({
    where: { id: studentId, ...(session.role === "ADMIN" ? {} : { class: { teacherId: session.uid } }) },
    select: { id: true },
  });
  if (!allowed) return;

  await db.mark.create({ data: { studentId, subject, exam, score, maxScore } });
  revalidatePath("/marks");
}

async function deleteMark(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN", "TEACHER");
  const id = String(formData.get("id"));
  await db.mark.deleteMany({
    where: { id, ...(session.role === "ADMIN" ? {} : { student: { class: { teacherId: session.uid } } }) },
  });
  revalidatePath("/marks");
}

export default async function MarksPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const session = await requireRole("ADMIN", "TEACHER");
  const { classId = "" } = await searchParams;

  const classes = await db.class.findMany({
    where: classScope(session),
    orderBy: [{ name: "asc" }, { section: "asc" }],
  });
  const selected = classes.find((c) => c.id === classId) ?? null;

  const students = selected
    ? await db.student.findMany({ where: { classId: selected.id }, orderBy: { name: "asc" } })
    : [];
  const marks = selected
    ? await db.mark.findMany({
        where: { student: { classId: selected.id } },
        orderBy: [{ exam: "asc" }, { subject: "asc" }],
        include: { student: true },
        take: 500,
      })
    : [];

  return (
    <main>
      <h1>Marks</h1>
      <div className="card">
        <form method="get" className="row">
          <label>
            Class
            <select name="classId" defaultValue={selected?.id ?? ""}>
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
          <button>Load</button>
        </form>
      </div>

      {selected && (
        <>
          <div className="card">
            <form action={addMark} className="row">
              <label>
                Student
                <select name="studentId" required>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Subject
                <input name="subject" required />
              </label>
              <label>
                Exam
                <input name="exam" placeholder="e.g. Term 1" required />
              </label>
              <label>
                Score
                <input name="score" type="number" step="0.01" min="0" required style={{ minWidth: 90 }} />
              </label>
              <label>
                Out of
                <input name="maxScore" type="number" step="0.01" min="1" defaultValue={100} style={{ minWidth: 90 }} />
              </label>
              <button>Add mark</button>
            </form>
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Exam</th>
                  <th>Subject</th>
                  <th>Score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {marks.map((m) => (
                  <tr key={m.id}>
                    <td>{m.student.name}</td>
                    <td>{m.exam}</td>
                    <td>{m.subject}</td>
                    <td>
                      {m.score} / {m.maxScore}
                    </td>
                    <td>
                      <form action={deleteMark}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="danger">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {marks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No marks recorded for this class yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}