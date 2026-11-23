import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const students = await db.student.findMany({
    orderBy: { name: "asc" },
    include: { class: true, parent: true },
  });
  const rows = students.map((s) => [
    s.admissionNo,
    s.name,
    s.class?.name ?? "",
    s.class?.section ?? "",
    s.parent?.email ?? "",
  ]);
  return csvResponse(
    "students.csv",
    toCsv(["admission_no", "name", "class", "section", "parent_email"], rows),
  );
}