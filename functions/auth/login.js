import { verifyPassword } from "../../utils/hash.js";

export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();

    // Fetch teacher by email
    const row = await env.DB.prepare(
      "SELECT id, password_hash FROM teachers WHERE email = ?"
    ).bind(email).first();

    if (!row) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify password
    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return await createSession(row.id, env);
  } catch (err) {
    console.error("❌ Login error:", err);
    return new Response(
      JSON.stringify({ error: "Login failed", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function createSession(teacherId, env) {
  const sessionId = crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 86400e3).toISOString();

  // Insert into sessions (schema uses id not session_id)
  await env.DB.prepare(
    "INSERT INTO sessions (id, teacher_id, expires_at) VALUES (?, ?, ?)"
  ).bind(sessionId, teacherId, expires).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; SameSite=Strict`,
    },
  });
}
