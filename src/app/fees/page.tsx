import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { classLabel, fmtDate, money, parseDate } from "@/lib/util";

async function addFee(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  const studentId = String(formData.get("studentId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const amount = Math.round(Number(formData.get("amount")));
  const paid = Math.round(Number(formData.get("paid") || 0));
  const dueDate = parseDate(String(formData.get("dueDate") ?? ""));
  if (!studentId || !title || !Number.isFinite(amount) || amount <= 0) return;
  if (!Number.isFinite(paid) || paid < 0 || paid > amount) return;
  await db.fee.create({ data: { studentId, title, amount, paid, dueDate } });
  revalidatePath("/fees");
}

async function recordPayment(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const add = Math.round(Number(formData.get("add")));
  if (!Number.isFinite(add) || add <= 0) return;
  const fee = await db.fee.findUnique({ where: { id } });
  if (!fee) return;
  await db.fee.update({ where: { id }, data: { paid: Math.min(fee.amount, fee.paid + add) } });
  revalidatePath("/fees");
}

async function deleteFee(formData: FormData) {
  "use server";
  await requireRole("ADMIN");
  await db.fee.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/fees");
}

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  await requireRole("ADMIN");
  const { pending } = await searchParams;

  const [students, allFees] = await Promise.all([
    db.student.findMany({ orderBy: { name: "asc" }, include: { class: true }, take: 1000 }),
    db.fee.findMany({ orderBy: { dueDate: "asc" }, include: { student: { include: { class: true } } }, take: 500 }),
  ]);
  const fees = pending ? allFees.filter((f) => f.paid < f.amount) : allFees;
  const outstanding = allFees.reduce((sum, f) => sum + (f.amount - f.paid), 0);

  return (
    <main>
      <h1>Fees</h1>
      <div className="card">
        <strong>Total outstanding: {money(outstanding)}</strong>{" "}
        <a href={pending ? "/fees" : "/fees?pending=1"} className="btn ghost" style={{ marginLeft: 12 }}>
          {pending ? "Show all" : "Show only unpaid"}
        </a>
      </div>

      <div className="card">
        <form action={addFee} className="row">
          <label>
            Student
            <select name="studentId" required>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({classLabel(s.class)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Fee title
            <input name="title" placeholder="e.g. Term 1 tuition" required />
          </label>
          <label>
            Amount (INR)
            <input name="amount" type="number" min="1" required style={{ minWidth: 100 }} />
          </label>
          <label>
            Paid so far
            <input name="paid" type="number" min="0" defaultValue={0} style={{ minWidth: 100 }} />
          </label>
          <label>
            Due date
            <input name="dueDate" type="date" />
          </label>
          <button>Add fee</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Fee</th>
              <th>Due</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Record payment</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fees.map((f) => (
              <tr key={f.id}>
                <td>
                  {f.student.name}
                  <div className="muted">{classLabel(f.student.class)}</div>
                </td>
                <td>{f.title}</td>
                <td>{fmtDate(f.dueDate) || "-"}</td>
                <td>{money(f.amount)}</td>
                <td>{money(f.paid)}</td>
                <td>
                  {f.paid < f.amount ? (
                    <form action={recordPayment} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="id" value={f.id} />
                      <input name="add" type="number" min="1" required style={{ minWidth: 80, width: 90 }} />
                      <button>Add</button>
                    </form>
                  ) : (
                    <span className="pill">paid</span>
                  )}
                </td>
                <td>
                  <form action={deleteFee}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="danger">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {fees.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No fee records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}