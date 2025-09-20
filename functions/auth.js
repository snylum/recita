import { nanoid } from "nanoid";
import { hash, compare } from "bcryptjs"; // Wrangler supports bcryptjs

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname.endsWith("/auth/signup")) {
    return signup(request, env);
  }
  if (url.pathname.endsWith("/auth/login")) {
    return login(request, env);
  }
  if (url.pathname.endsWith("/auth/logout")) {
    return logout(request, env);
  }

  return new Response("Not found", { status: 404 });
}

async function signup(request, env) {
  const { email, password } = await request.json();
  const hashed = await hash(password, 10);

  try {
    await env.DB.prepare(
      "INSERT INTO teachers (email, password_hash) VALUES (?, ?)"
    ).bind(email, hashed).run();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Email already exists" }), { status: 400 });
  }
}

async function login(request, env) {
  const { email, password } = await request.json();
  const teacher = await env.DB.prepare(
    "SELECT * FROM teachers WHERE email = ?"
  ).bind(email).first();

  if (!teacher) return new Response("Invalid credentials", { status: 401 });

  const ok = await compare(password, teacher.password_hash);
  if (!ok) return new Response("Invalid credentials", { status: 401 });

  const sessionId = nanoid();
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(); // 6 hours

  await env.DB.prepare(
    "INSERT INTO sessions (id, teacher_id, expires_at) VALUES (?, ?, ?)"
  ).bind(sessionId, teacher.id, expiresAt).run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${6 * 60 * 60}`
    }
  });
}

async function logout(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const sessionId = cookie.split("session=")[1]?.split(";")[0];
  if (sessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Set-Cookie": "session=; Path=/; Max-Age=0" }
  });
}
