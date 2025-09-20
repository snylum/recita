import { getTeacherFromSession } from "../utils/session.js";

export async function onRequestPost({ request, env }) {
  const teacher = await getTeacherFromSession(request, env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  const { studentId, status, points } = await request.json();
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO attendance (student_id, status, points, created_at) VALUES (?, ?, ?, ?)"
  ).bind(studentId, status, points || 0, now).run();

  return new Response(JSON.stringify({ success: true }));
}
