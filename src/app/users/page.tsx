import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

async function addUser(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!name || !email || password.length < 8) return;
  if (role !== "TEACHER" && role !== "PARENT" && role !== "ADMIN") return;
  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.upsert({
    where: { email },
    update: { name, passwordHash, role },
    create: { name, email, passwordHash, role },
  });
  revalidatePath("/users");
}

async function deleteUser(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  if (id === session.uid) return;
  await db.user.delete({ where: { id } });
  revalidatePath("/users");
}

export default async function UsersPage() {
  await requireRole("ADMIN");
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { _count: { select: { children: true, classes: true } } },
  });

  return (
    <main>
      <h1>Users</h1>
      <div className="card">
        <form action={addUser} className="row">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password (min 8)
            <input name="password" type="password" minLength={8} required />
          </label>
          <label>
            Role
            <select name="role" defaultValue="TEACHER">
              <option value="TEACHER">Teacher</option>
              <option value="PARENT">Parent</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <button>Save user</button>
        </form>
        <p className="muted">
          Saving an existing email resets that person&apos;s name, password and role. Link a parent to
          their child on the Students page (or through the CSV import).
        </p>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Linked</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className="pill">{u.role.toLowerCase()}</span>
                </td>
                <td>
                  {u.role === "PARENT" && `${u._count.children} child(ren)`}
                  {u.role === "TEACHER" && `${u._count.classes} class(es)`}
                </td>
                <td>
                  <form action={deleteUser}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="danger">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}