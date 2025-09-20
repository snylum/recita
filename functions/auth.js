import { v4 as uuidv4 } from "uuid"; // Wrangler supports uuid

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname.endsWith("/signup")) {
    const { username, password } = await request.json();
    await env.DB.prepare(
      "INSERT INTO teachers (username, password) VALUES (?, ?)"
    ).bind(username, password).run();
    return new Response("Signup successful", { status: 200 });
  }

  if (url.pathname.endsWith("/login")) {
    const { username, password } = await request.json();
    const result = await env.DB.prepare(
      "SELECT * FROM teachers WHERE username = ? AND password = ?"
    ).bind(username, password).first();

    if (!result) {
      return new Response("Invalid credentials", { status: 401 });
    }

    const sessionId = uuidv4();
    await env.DB.prepare(
      "INSERT INTO sessions (teacher_id, session_id, expires_at) VALUES (?, ?, datetime('now', '+6 hours'))"
    ).bind(result.id, sessionId).run();

    return new Response("Login successful", {
      status: 200,
      headers: {
        "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=21600`
      }
    });
  }

  if (url.pathname.endsWith("/logout")) {
    return new Response("Logged out", {
      status: 200,
      headers: {
        "Set-Cookie": "session=; Path=/; Max-Age=0"
      }
    });
  }

  return new Response("Not found", { status: 404 });
}
