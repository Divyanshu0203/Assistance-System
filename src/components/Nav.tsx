import Link from "next/link";
import { getSession, destroySession, type Role } from "@/lib/auth";
import { redirect } from "next/navigation";

const links: { href: string; label: string; roles: Role[] }[] = [
  { href: "/students", label: "Students", roles: ["ADMIN", "TEACHER"] },
  { href: "/classes", label: "Classes", roles: ["ADMIN"] },
  { href: "/attendance", label: "Attendance", roles: ["ADMIN", "TEACHER"] },
  { href: "/marks", label: "Marks", roles: ["ADMIN", "TEACHER"] },
  { href: "/fees", label: "Fees", roles: ["ADMIN"] },
  { href: "/reports", label: "Reports", roles: ["ADMIN", "TEACHER"] },
  { href: "/import", label: "Import", roles: ["ADMIN"] },
  { href: "/users", label: "Users", roles: ["ADMIN"] },
  { href: "/parent", label: "My children", roles: ["PARENT"] },
];

async function logout() {
  "use server";
  await destroySession();
  redirect("/login");
}

export default async function Nav() {
  const session = await getSession();
  if (!session) return null;
  return (
    <nav className="top">
      <span className="brand">Assistance System</span>
      {links
        .filter((l) => l.roles.includes(session.role))
        .map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      <span className="spacer" />
      <span className="who">
        {session.name} · {session.role.toLowerCase()}
      </span>
      <form action={logout}>
        <button className="ghost">Log out</button>
      </form>
    </nav>
  );
}