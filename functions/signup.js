import { hashPassword } from "../utils/hash.js";

export async function onRequestPost(context) {
  const formData = await context.request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (!username || !password) {
    return new Response("Missing fields", { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  try {
    await context.env.DB.prepare(
      "INSERT INTO users (username, passwordHash) VALUES (?1, ?2)"
    ).bind(username, passwordHash).run();
  } catch (e) {
    return new Response("User already exists", { status: 409 });
  }

  return Response.redirect("/login.html", 302);
}
