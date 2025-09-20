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

  if (request.method === "POST" && url.pathname.endsWith("/class")) {
    const { name } = await request.json();
    await env.DB.prepare(
      "INSERT INTO classes (teacher_id, name) VALUES (?, ?)"
    ).bind(teacher.teacher_id, name).run();
    return new Response("Class added", { status: 200 });
  }

  if (request.method === "GET" && url.pathname.endsWith("/classes")) {
    const rows = await env.DB.prepare(
      "SELECT * FROM classes WHERE teacher_id = ?"
    ).bind(teacher.teacher_id).all();
    return Response.json(rows.results);
  }

  return new Response("Not found", { status: 404 });
}
