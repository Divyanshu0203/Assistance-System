import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, getSession, homeFor } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) redirect("/login?error=1");
  await createSession({ uid: user.id, role: user.role, name: user.name });
  redirect(homeFor(user.role));
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  const { error } = await searchParams;

  return (
    <div className="login-wrap card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Logo" />
      <h1 style={{ textAlign: "center" }}>Sign in</h1>
      {error && <div className="notice err">Wrong email or password.</div>}
      <form action={login}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button>Sign in</button>
      </form>
    </div>
  );
}