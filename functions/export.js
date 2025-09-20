export async function onRequest(context) {
  const { request, env } = context;

  // Verify session
  const sessionId = request.headers.get("Cookie")?.split("=")[1];
  if (!sessionId) return new Response("Unauthorized", { status: 401 });
  const teacher = await env.DB.prepare(
    "SELECT teacher_id FROM sessions WHERE session_id = ? AND expires_at > datetime('now')"
  ).bind(sessionId).first();
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  const rows = await env.DB.prepare(
    `SELECT s.name, c.name AS class, a.status, a.points, a.created_at
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     JOIN classes c ON s.class_id = c.id
     WHERE c.teacher_id = ?`
  ).bind(teacher.teacher_id).all();

  let csv = "Student,Class,Status,Points,Date\n";
  rows.results.forEach(r => {
    csv += `${r.name},${r.class},${r.status},${r.points},${r.created_at}\n`;
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=attendance.csv"
    }
  });
}
