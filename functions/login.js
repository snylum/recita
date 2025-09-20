import { verifyPassword } from "../utils/hash.js";

export async function onRequestPost(context) {
  const formData = await context.request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  const row = await context.env.DB.prepare(
    "SELECT * FROM users WHERE username = ?1"
  ).bind(username).first();

  if (!row) return new Response("User not found", { status: 401 });

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) return new Response("Invalid password", { status: 401 });

  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": `session=${username}; Path=/; HttpOnly; Secure; SameSite=Strict`,
      "Location": "/app",
    },
  });
}
