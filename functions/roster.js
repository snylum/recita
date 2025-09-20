import { getTeacherFromSession } from "../utils/session.js";

export async function onRequest(context) {
  const { request, env } = context;
  const teacher = await getTeacherFromSession(request, env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);

  // Add a class
  if (request.method === "POST" && url.pathname.endsWith("/roster/class")) {
    const { name } = await request.json();
    await env.DB.prepare("INSERT INTO classes (teacher_id, name) VALUES (?, ?)")
      .bind(teacher.id, name).run();
    return new Response(JSON.stringify({ success: true }));
  }

  // Add a student
  if (request.method === "POST" && url.pathname.endsWith("/roster/student")) {
    const { classId, name } = await request.json();
    await env.DB.prepare("INSERT INTO students (class_id, name) VALUES (?, ?)")
      .bind(classId, name).run();
    return new Response(JSON.stringify({ success: true }));
  }

  // Get all classes + students
  if (request.method === "GET" && url.pathname.endsWith("/roster")) {
    const classes = await env.DB.prepare("SELECT * FROM classes WHERE teacher_id = ?")
      .bind(teacher.id).all();

    const students = await env.DB.prepare(
      "SELECT * FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)"
    ).bind(teacher.id).all();

    return new Response(JSON.stringify({ classes: classes.results, students: students.results }));
  }

  return new Response("Not found", { status: 404 });
}
