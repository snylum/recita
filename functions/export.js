export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");

  const rows = await env.DB.prepare(
    `SELECT s.name, a.status, a.points, a.date
     FROM students s
     JOIN attendance a ON a.student_id = s.id
     WHERE s.section_id = ?`
  ).bind(sectionId).all();

  const header = "Name,Status,Points,Date\n";
  const csv = header + rows.results.map(
    r => `${r.name},${r.status},${r.points ?? ""},${r.date}`
  ).join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=attendance.csv"
    }
  });
}
