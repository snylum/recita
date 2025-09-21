export async function onRequestGet(context) {
  const teacherId = await getTeacherId(context);
  const { results } = await context.env.DB.prepare(
    "SELECT id, name FROM classes WHERE teacher_id = ?"
  ).bind(teacherId).all();

  return Response.json(results);
}

export async function onRequestPost(context) {
  const teacherId = await getTeacherId(context);
  const { name } = await context.request.json();

  const { lastRowId } = await context.env.DB.prepare(
    "INSERT INTO classes (teacher_id, name) VALUES (?, ?)"
  ).bind(teacherId, name).run();

  return Response.json({ id: lastRowId, name });
}

// Helper: extract teacherId from session
async function getTeacherId(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  const match = cookie.match(/session_id=([^;]+)/);
  if (!match) throw new Response("Unauthorized", { status: 401 });

  const sessionId = match[1];
  const { results } = await context.env.DB.prepare(
    "SELECT teacher_id FROM sessions WHERE id = ?"
  ).bind(sessionId).all();

  if (!results.length) throw new Response("Unauthorized", { status: 401 });
  return results[0].teacher_id;
}
