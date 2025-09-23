import { getTeacherFromSession } from "./utils/session.js";

export async function onRequestGet(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const url = new URL(context.request.url);
  const classId = url.searchParams.get("classId");
  
  await ensureClassOwnership(context, teacher.id, classId);
  
  const { results } = await context.env.DB.prepare(
    "SELECT id, name FROM students WHERE class_id = ?"
  ).bind(classId).all();
  
  return Response.json(results);
}

export async function onRequestPost(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const { classId, names } = await context.request.json();
  
  await ensureClassOwnership(context, teacher.id, classId);
  
  const inserted = [];
  for (const name of names) {
    if (name.trim()) {
      const { lastRowId } = await context.env.DB.prepare(
        "INSERT INTO students (class_id, name) VALUES (?, ?)"
      ).bind(classId, name.trim()).run();
      inserted.push({ id: lastRowId, name: name.trim() });
    }
  }
  
  return Response.json(inserted);
}

// Helpers
async function ensureClassOwnership(context, teacherId, classId) {
  const { results } = await context.env.DB.prepare(
    "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
  ).bind(classId, teacherId).all();
  if (!results.length) throw new Response("Forbidden", { status: 403 });
}
