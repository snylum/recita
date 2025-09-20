export async function onRequestPost(context) {
  const teacherId = await getTeacherId(context);
  const body = await context.request.json();

  // Case 1: Create recita session
  if (body.topic && body.classId) {
    await ensureClassOwnership(context, teacherId, body.classId);

    const { lastRowId } = await context.env["recita-users"].prepare(
      "INSERT INTO recita_sessions (class_id, topic, created_at) VALUES (?, ?, datetime('now'))"
    ).bind(body.classId, body.topic).run();

    return Response.json({ id: lastRowId, topic: body.topic });
  }

  // Case 2: Mark attendance/score
  if (body.recitaId && body.studentId) {
    await context.env["recita-users"].prepare(
      "INSERT INTO attendance (recita_id, student_id, score) VALUES (?, ?, ?)"
    ).bind(body.recitaId, body.studentId, body.score).run();

    return Response.json({ ok: true });
  }

  return new Response("Bad request", { status: 400 });
}

// Pick random student endpoint
export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  if (url.pathname.endsWith("/pick")) {
    const teacherId = await getTeacherId(context);
    const recitaId = url.searchParams.get("recitaId");

    // Get classId from recita
    const { results: recitaRows } = await context.env["recita-users"].prepare(
      "SELECT class_id FROM recita_sessions WHERE id = ?"
    ).bind(recitaId).all();

    if (!recitaRows.length) throw new Response("Not found", { status: 404 });
    const classId = recitaRows[0].class_id;

    await ensureClassOwnership(context, teacherId, classId);

    // Students not yet marked
    const { results } = await context.env["recita-users"].prepare(`
      SELECT s.id, s.name 
      FROM students s
      WHERE s.class_id = ?
      AND s.id NOT IN (SELECT student_id FROM attendance WHERE recita_id = ?)
    `).bind(classId, recitaId).all();

    if (!results.length) return Response.json(null);

    const random = results[Math.floor(Math.random() * results.length)];
    return Response.json(random);
  }

  return new Response("Not found", { status: 404 });
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
