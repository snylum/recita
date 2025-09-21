import { hashPassword } from "../../utils/hash.js";

export async function onRequestPost({ request, env }) {
  try {
    const { name, email, password } = await request.json();

    // Check if email already exists
    const existing = await env.DB.prepare(
      "SELECT id FROM teachers WHERE email = ?"
    ).bind(email).first();

    if (existing) {
      return new Response(JSON.stringify({ error: "Email already in use" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Hash password
    const hashed = await hashPassword(password);

    // Insert new teacher
    await env.DB.prepare(
      "INSERT INTO teachers (name, email, password_hash) VALUES (?, ?, ?)"
    ).bind(name, email, hashed).run();

    // Create session immediately
    return await createSession(email, env);
  } catch (err) {
    console.error("❌ Signup error:", err);
    return new Response(
      JSON.stringify({ error: "Signup failed", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function createSession(email, env) {
  const teacher = await env.DB.prepare(
    "SELECT id FROM teachers WHERE email = ?"
  ).bind(email).first();

  if (!teacher) {
    throw new Error("Teacher not found after signup");
  }

  const sessionId = crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 86400e3).toISOString();

  await env.DB.prepare(
    "INSERT INTO sessions (id, teacher_id, expires_at) VALUES (?, ?, ?)"
  ).bind(sessionId, teacher.id, expires).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; SameSite=Strict`,
    },
  });
}
