import { getTeacherFromSession } from "../utils/session.js";

export async function onRequestPost(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  const body = await context.request.json();

  // Case 1: Create recita session
  if (body.topic && body.classId) {
    await ensureClassOwnership(context, teacher.id, body.classId);

    const { lastRowId } = await context.env.DB.prepare(
      "INSERT INTO recita_sessions (class_id, topic, created_at) VALUES (?, ?, datetime('now'))"
    ).bind(body.classId, body.topic).run();

    return Response.json({ id: lastRowId, topic: body.topic });
  }

  // Case 2: Mark attendance/score
  if (body.recitaId && body.studentId) {
    await context.env.DB.prepare(
      "INSERT INTO attendance (recita_id, student_id, score) VALUES (?, ?, ?)"
    ).bind(body.recitaId, body.studentId, body.score).run();

    return Response.json({ ok: true });
  }

  return new Response("Bad request", { status: 400 });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  if (url.pathname.endsWith("/pick")) {
    const teacher = await getTeacherFromSession(context.request, context.env);
    if (!teacher) return new Response("Unauthorized", { status: 401 });

    const recitaId = url.searchParams.get("recitaId");

    const { results: recitaRows } = await context.env.DB.prepare(
      "SELECT class_id FROM recita_sessions WHERE id = ?"
    ).bind(recitaId).all();

    if (!recitaRows.length) throw new Response("Not found", { status: 404 });
    const classId = recitaRows[0].class_id;

    await ensureClassOwnership(context, teacher.id, classId);

    const { results } = await context.env.DB.prepare(`
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
async function ensureClassOwnership(context, teacherId, classId) {
  const { results } = await context.env.DB.prepare(
    "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
  ).bind(classId, teacherId).all();

  if (!results.length) throw new Response("Forbidden", { status: 403 });
}
