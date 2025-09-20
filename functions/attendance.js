export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Verify session
  const sessionId = request.headers.get("Cookie")?.split("=")[1];
  if (!sessionId) return new Response("Unauthorized", { status: 401 });
  const teacher = await env.DB.prepare(
    "SELECT teacher_id FROM sessions WHERE session_id = ? AND expires_at > datetime('now')"
  ).bind(sessionId).first();
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  if (request.method === "GET" && url.pathname.endsWith("/pick")) {
    const row = await env.DB.prepare(
      `SELECT s.id, s.name, c.name AS class
       FROM students s
       JOIN classes c ON s.class_id = c.id
       WHERE c.teacher_id = ?
       ORDER BY RANDOM() LIMIT 1`
    ).bind(teacher.teacher_id).first();

    return Response.json(row || { message: "No students found" });
  }

  if (request.method === "POST" && url.pathname.endsWith("/mark")) {
    const { student_id, status, points } = await request.json();
    await env.DB.prepare(
      `INSERT INTO attendance (student_id, status, points, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).bind(student_id, status, points || 0).run();

    return new Response("Attendance recorded", { status: 200 });
  }

  return new Response("Not found", { status: 404 });
}
