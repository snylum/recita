// utils/session.js
export async function getTeacherFromSession(request, env) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  
  const session = cookie
    .split(";")
    .find(c => c.trim().startsWith("session="));
  if (!session) return null;
  
  const sessionId = session.split("=")[1];
  
  // Fixed: Changed 't.username' to 't.name' to match your schema
  const row = await env.DB.prepare(
    `SELECT t.id, t.name, t.email
     FROM sessions s
     JOIN teachers t ON s.teacher_id = t.id
     WHERE s.id = ? AND s.expires_at > ?`
  ).bind(sessionId, new Date().toISOString()).first();
  
  return row || null; // { id, name, email }
}
