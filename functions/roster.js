export async function onRequestPost(context) {
  const { request, env } = context;
  const { action, name, sectionId } = await request.json();

  if (action === "addSection") {
    const teacherId = await getTeacherId(request, env);
    await env.DB.prepare(
      "INSERT INTO sections (teacher_id, name) VALUES (?, ?)"
    ).bind(teacherId, name).run();
    return new Response(JSON.stringify({ success: true }));
  }

  if (action === "addStudent") {
    await env.DB.prepare(
      "INSERT INTO students (section_id, name) VALUES (?, ?)"
    ).bind(sectionId, name).run();
    return new Response(JSON.stringify({ success: true }));
  }

  return new Response("Invalid action", { status: 400 });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const teacherId = await getTeacherId(request, env);
  const sections = await env.DB.prepare(
    "SELECT * FROM sections WHERE teacher_id = ?"
  ).bind(teacherId).all();

  for (let section of sections.results) {
    section.students = await env.DB.prepare(
      "SELECT * FROM students WHERE section_id = ?"
    ).bind(section.id).all().then(r => r.results);
  }

  return new Response(JSON.stringify(sections.results), { status: 200 });
}

async function getTeacherId(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const sessionId = cookie.split("session=")[1]?.split(";")[0];
  if (!sessionId) throw new Error("Not logged in");

  const session = await env.DB.prepare(
    "SELECT * FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP"
  ).bind(sessionId).first();

  if (!session) throw new Error("Invalid session");
  return session.teacher_id;
}
