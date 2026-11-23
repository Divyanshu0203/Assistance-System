import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

type Role = "ADMIN" | "TEACHER" | "PARENT";

const rules: [string, Role[]][] = [
  ["/students", ["ADMIN", "TEACHER"]],
  ["/classes", ["ADMIN"]],
  ["/attendance", ["ADMIN", "TEACHER"]],
  ["/reports", ["ADMIN", "TEACHER"]],
  ["/import", ["ADMIN"]],
  ["/marks", ["ADMIN", "TEACHER"]],
  ["/fees", ["ADMIN"]],
  ["/users", ["ADMIN"]],
  ["/parent", ["PARENT"]],
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = rules.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"));
  if (!rule) return NextResponse.next();

  const login = new URL("/login", req.url);
  const token = req.cookies.get("session")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.redirect(login);

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = payload.role as Role;
    if (!rule[1].includes(role)) {
      return NextResponse.redirect(new URL(role === "PARENT" ? "/parent" : "/students", req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|api).*)"],
};