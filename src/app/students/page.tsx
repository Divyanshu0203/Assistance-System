import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, classScope } from "@/lib/auth";
import { classLabel } from "@/lib/util";

async function saveStudent(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  const admissionNo = String(formData.get("admissionNo") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const classId = String(formData.get("classId") ?? "") || null;
  const parentEmail = String(formData.get("parentEmail") ?? "").trim().toLowerCase();
  if (!admissionNo || !name) return;

  let parentId: string | null = null;
  if (parentEmail) {
    const parent = await db.user.findFirst({ where: { email: parentEmail, role: "PARENT" } });
    parentId = parent?.id ?? null;
  }
  await db.student.upsert({
    where: { admissionNo },
    update: { name, classId, ...(parentEmail ? { parentId } : {}) },
    create: { admissionNo, name, classId, parentId },
  });
  revalidatePath("/students");
}

async function deleteStudent(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  await db.student.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/students");
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; classId?: string }>;
}) {
  const session = await requireRole("ADMIN", "TEACHER");
  const { q = "", classId = "" } = await searchParams;
  const isAdmin = session.role === "ADMIN";

  const classes = await db.class.findMany({
    where: classScope(session),
    orderBy: [{ name: "asc" }, { section: "asc" }],
  });
  const allowedIds = classes.map((c) => c.id);

  const students = await db.student.findMany({
    where: {
      ...(isAdmin ? {} : { classId: { in: allowedIds } }),
      ...(classId ? { classId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { admissionNo: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }],
    include: { class: true, parent: true },
    take: 500,
  });

  return (
    <main>
      <h1>Students</h1>

      {isAdmin && (
        <div className="card">
          <form action={saveStudent} className="row">
            <label>
              Admission no.
              <input name="admissionNo" required />
            </label>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Class
              <select name="classId" defaultValue="">
                <option value="">None</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Parent email (optional)
              <input name="parentEmail" type="email" />
            </label>
            <button>Save student</button>
          </form>
          <p className="muted">
            Saving an existing admission number updates that student. The parent must already exist
            on the Users page.
          </p>
        </div>
      )}

      <div className="card">
        <form className="row" method="get">
          <label>
            Search
            <input name="q" defaultValue={q} placeholder="Name or admission no." />
          </label>
          <label>
            Class
            <select name="classId" defaultValue={classId}>
              <option value="">All</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <button>Filter</button>
          {isAdmin && (
            <a className="btn ghost" href="/api/export/students">
              Export CSV
            </a>
          )}
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Adm. no.</th>
              <th>Name</th>
              <th>Class</th>
              <th>Parent</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.admissionNo}</td>
                <td>{s.name}</td>
                <td>{classLabel(s.class)}</td>
                <td>{s.parent?.name ?? "-"}</td>
                {isAdmin && (
                  <td>
                    <form action={deleteStudent}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="danger">Delete</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}