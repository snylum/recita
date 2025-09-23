import { getTeacherFromSession } from "../../utils/session.js";

export async function onRequestGet(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const classId = context.params.id;
  
  const { results } = await context.env.DB.prepare(
    "SELECT id, name FROM classes WHERE id = ? AND teacher_id = ?"
  ).bind(classId, teacher.id).all();
  
  if (!results.length) {
    return new Response("Class not found", { status: 404 });
  }
  
  return Response.json(results[0]);
}
