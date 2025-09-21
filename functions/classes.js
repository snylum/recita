import { getTeacherFromSession } from "./utils/session.js";

export async function onRequestGet(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  const { results } = await context.env.DB.prepare(
    "SELECT id, name FROM classes WHERE teacher_id = ?"
  ).bind(teacher.id).all();

  return Response.json(results);
}

export async function onRequestPost(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  const { name } = await context.request.json();

  const { lastRowId } = await context.env.DB.prepare(
    "INSERT INTO classes (teacher_id, name) VALUES (?, ?)"
  ).bind(teacher.id, name).run();

  return Response.json({ id: lastRowId, name });
}
