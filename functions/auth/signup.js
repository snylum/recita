import { hashPassword } from "../../utils/hash.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { username, password } = await request.json();

  const hashed = await hashPassword(password);

  try {
    await env.DB.prepare(
      "INSERT INTO teachers (username, password) VALUES (?, ?)"
    ).bind(username, hashed).run();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "DB error: " + err.message }),
      { status: 400 }
    );
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
