import { hashPassword, verifyPassword } from "../utils/hash.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname.endsWith("/auth/signup")) {
    const { username, password } = await request.json();

    const hashed = await hashPassword(password);

    try {
      await env.DB.prepare(
        "INSERT INTO teachers (username, password) VALUES (?, ?)"
      ).bind(username, hashed).run();
    } catch {
      return new Response(JSON.stringify({ error: "Username taken" }), { status: 400 });
    }

    return await createSession(username, env);
  }

  if (url.pathname.endsWith("/auth/login")) {
    const { username, password } = await request.json();
    const row = await env.DB.prepare(
      "SELECT id, password FROM teachers WHERE username = ?"
    ).bind(username).first();

    if (!row) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

    const valid = await verifyPassword(password, row.password);
    if (!valid) return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401 });

    return await createSession(username, env);
  }

  if (url.pathname.endsWith("/auth/logout")) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Set-Cookie": "session=; Path=/; HttpOnly; Max-Age=0" }
    });
  }

  return new Response("Not found", { status: 404 });
}

async function createSession(username, env) {
  const teacher = await env.DB.prepare(
    "SELECT id FROM teachers WHERE username = ?"
  ).bind(username).first();

  const sessionId = crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 86400e3).toISOString();

  await env.DB.prepare(
    "INSERT INTO sessions (teacher_id, session_id, expires_at) VALUES (?, ?, ?)"
  ).bind(teacher.id, sessionId, expires).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; SameSite=Strict`
    }
  });
}
