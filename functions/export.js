import { getTeacherFromSession } from "../utils/session.js";

export async function onRequestGet({ request, env }) {
  const teacher = await getTeacherFromSession(request, env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  const rows = await env.DB.prepare(
    `SELECT s.name as student, c.name as class, a.score, a.created_at
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     JOIN classes c ON s.class_id = c.id
     WHERE c.teacher_id = ?`
  ).bind(teacher.id).all();

  let csv = "Student,Class,Score,Date\n";
  for (const r of rows.results) {
    csv += `${r.student},${r.class},${r.score ?? ""},${r.created_at}\n`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=attendance.csv"
    }
  });
}
