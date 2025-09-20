export async function onRequestGet(context) {
  const teacherId = await getTeacherId(context);
  const url = new URL(context.request.url);
  const classId = url.searchParams.get("classId");

  // Ensure class belongs to teacher
  await ensureClassOwnership(context, teacherId, classId);

  const { results } = await context.env["recita-users"].prepare(
    "SELECT id, name FROM students WHERE class_id = ?"
  ).bind(classId).all();

  return Response.json(results);
}

export async function onRequestPost(context) {
  const teacherId = await getTeacherId(context);
  const { classId, students } = await context.request.json();

  await ensureClassOwnership(context, teacherId, classId);

  const db = context.env["recita-users"];
  const inserted = [];

  for (const name of students) {
    const { lastRowId } = await db.prepare(
      "INSERT INTO students (class_id, name) VALUES (?, ?)"
    ).bind(classId, name).run();
    inserted.push({ id: lastRowId, name });
  }

  return Response.json(inserted);
}

// Helpers
async function getTeacherId(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  const match = cookie.match(/session_id=([^;]+)/);
  if (!match) throw new Response("Unauthorized", { status: 401 });

  const sessionId = match[1];
  const { results } = await context.env["recita-users"].prepare(
    "SELECT teacher_id FROM sessions WHERE id = ?"
  ).bind(sessionId).all();

  if (!results.length) throw new Response("Unauthorized", { status: 401 });
  return results[0].teacher_id;
}

async function ensureClassOwnership(context, teacherId, classId) {
  const { results } = await context.env["recita-users"].prepare(
    "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
  ).bind(classId, teacherId).all();

  if (!results.length) throw new Response("Forbidden", { status: 403 });
}
