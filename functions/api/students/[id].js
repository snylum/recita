import { getTeacherFromSession } from "../../utils/session.js";

export async function onRequestPut(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const studentId = context.params.id;
  const { name } = await context.request.json();
  
  if (!name || !name.trim()) {
    return new Response("Name is required", { status: 400 });
  }
  
  // Verify ownership through class
  const verifyQuery = `
    SELECT s.id FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.id = ? AND c.teacher_id = ?
  `;
  
  const { results } = await context.env.DB.prepare(verifyQuery)
    .bind(studentId, teacher.id).all();
  
  if (!results.length) {
    return new Response("Student not found or access denied", { status: 404 });
  }
  
  await context.env.DB.prepare("UPDATE students SET name = ? WHERE id = ?")
    .bind(name.trim(), studentId).run();
  
  return Response.json({ success: true });
}

export async function onRequestDelete(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const studentId = context.params.id;
  
  // Verify ownership through class
  const verifyQuery = `
    SELECT s.id FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.id = ? AND c.teacher_id = ?
  `;
  
  const { results } = await context.env.DB.prepare(verifyQuery)
    .bind(studentId, teacher.id).all();
  
  if (!results.length) {
    return new Response("Student not found or access denied", { status: 404 });
  }
  
  await context.env.DB.prepare("DELETE FROM students WHERE id = ?")
    .bind(studentId).run();
  
  return Response.json({ success: true });
}
