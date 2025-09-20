export async function onRequestPost(context) {
  const { request, env } = context;
  const { studentId, status, points } = await request.json();

  await env.DB.prepare(
    "INSERT INTO attendance (student_id, status, points) VALUES (?, ?, ?)"
  ).bind(studentId, status, points).run();

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");

  const students = await env.DB.prepare(
    `SELECT s.id, s.name,
            a.status, a.points, a.date
     FROM students s
     LEFT JOIN attendance a ON a.student_id = s.id
     WHERE s.section_id = ?`
  ).bind(sectionId).all();

  return new Response(JSON.stringify(students.results), { status: 200 });
}
