import { verifyPassword } from "../../utils/hash.js";

export async function onRequestPost({ request, env }) {
  const { email, password } = await request.json();

  const row = await env.DB.prepare(
    "SELECT id, password FROM teachers WHERE email = ?"
  )
    .bind(email)
    .first();

  if (!row) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const valid = await verifyPassword(password, row.password);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return await createSession(email, env);
}

async function createSession(email, env) {
  const teacher = await env.DB.prepare(
    "SELECT id FROM teachers WHERE email = ?"
  )
    .bind(email)
    .first();

  const sessionId = crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 86400e3).toISOString(); // 7 days

  await env.DB.prepare(
    "INSERT INTO sessions (teacher_id, session_id, expires_at) VALUES (?, ?, ?)"
  )
    .bind(teacher.id, sessionId, expires)
    .run();

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; SameSite=Strict`
    }
  });
}
