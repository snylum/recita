import { hashPassword } from "../../utils/hash.js";

export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json();

  const hashed = await hashPassword(password);

  try {
    await env.DB.prepare(
      "INSERT INTO teachers (username, password) VALUES (?, ?)"
    )
      .bind(username, hashed)
      .run();
  } catch {
    return new Response(JSON.stringify({ error: "Username taken" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  return await createSession(username, env);
}

async function createSession(username, env) {
  const teacher = await env.DB.prepare(
    "SELECT id FROM teachers WHERE username = ?"
  )
    .bind(username)
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
