import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { classLabel } from "@/lib/util";

async function addClass(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "") || null;
  if (!name) return;
  await db.class.upsert({
    where: { name_section: { name, section } },
    update: { teacherId },
    create: { name, section, teacherId },
  });
  revalidatePath("/classes");
}

async function deleteClass(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  await db.class.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/classes");
}

export default async function ClassesPage() {
  await requireRole("ADMIN");
  const [classes, teachers] = await Promise.all([
    db.class.findMany({
      orderBy: [{ name: "asc" }, { section: "asc" }],
      include: { teacher: true, _count: { select: { students: true } } },
    }),
    db.user.findMany({ where: { role: "TEACHER" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <main>
      <h1>Classes</h1>
      <div className="card">
        <form action={addClass} className="row">
          <label>
            Class name
            <input name="name" placeholder="e.g. 8" required />
          </label>
          <label>
            Section
            <input name="section" placeholder="e.g. A" />
          </label>
          <label>
            Class teacher
            <select name="teacherId" defaultValue="">
              <option value="">Unassigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button>Save class</button>
        </form>
        <p className="muted">Saving an existing class and section updates its teacher.</p>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Teacher</th>
              <th>Students</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td>{classLabel(c)}</td>
                <td>{c.teacher?.name ?? "-"}</td>
                <td>{c._count.students}</td>
                <td>
                  <form action={deleteClass}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="danger">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {classes.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No classes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}