import { db } from "@/lib/db";
import { getSession, classScope } from "@/lib/auth";
import { csvResponse, monthRange, toCsv } from "@/lib/csv";
import { fmtDate } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.role === "PARENT") return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const classId = url.searchParams.get("classId") ?? "";
  const range = monthRange(url.searchParams.get("month") ?? "");
  if (!classId || !range) return new Response("classId and month (YYYY-MM) are required", { status: 400 });

  const cls = await db.class.findFirst({ where: { id: classId, ...classScope(session) } });
  if (!cls) return new Response("Not found", { status: 404 });

  const records = await db.attendance.findMany({
    where: { student: { classId }, date: { gte: range.from, lt: range.to } },
    orderBy: [{ date: "asc" }, { student: { name: "asc" } }],
    include: { student: true },
  });
  const rows = records.map((r) => [r.student.admissionNo, r.student.name, fmtDate(r.date), r.status]);
  return csvResponse(
    `attendance-${cls.name}${cls.section}-${url.searchParams.get("month")}.csv`,
    toCsv(["admission_no", "name", "date", "status"], rows),
  );
}