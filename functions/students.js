import { getTeacherFromSession } from "./utils/session.js";

export async function onRequestGet(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const url = new URL(context.request.url);
  const classId = url.searchParams.get("classId");
  
  if (!classId) {
    return new Response("classId parameter is required", { status: 400 });
  }
  
  await ensureClassOwnership(context, teacher.id, classId);
  
  const { results } = await context.env.DB.prepare(
    "SELECT id, name FROM students WHERE class_id = ? ORDER BY name"
  ).bind(classId).all();
  
  return Response.json(results);
}

export async function onRequestPost(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const { classId, names } = await context.request.json();
  
  if (!classId) {
    return new Response("classId is required", { status: 400 });
  }
  
  if (!names || !Array.isArray(names)) {
    return new Response("names must be an array", { status: 400 });
  }
  
  await ensureClassOwnership(context, teacher.id, classId);
  
  const inserted = [];
  for (const name of names) {
    if (name && name.trim()) {
      const { lastRowId } = await context.env.DB.prepare(
        "INSERT INTO students (class_id, name) VALUES (?, ?)"
      ).bind(classId, name.trim()).run();
      inserted.push({ id: lastRowId, name: name.trim() });
    }
  }
  
  return Response.json(inserted);
}

export async function onRequestPut(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const { studentId, name, classId } = await context.request.json();
  
  if (!studentId || !name || !classId) {
    return new Response("studentId, name, and classId are required", { status: 400 });
  }
  
  await ensureClassOwnership(context, teacher.id, classId);
  
  // Verify the student belongs to the class
  const { results: studentCheck } = await context.env.DB.prepare(
    "SELECT id FROM students WHERE id = ? AND class_id = ?"
  ).bind(studentId, classId).all();
  
  if (!studentCheck.length) {
    return new Response("Student not found in this class", { status: 404 });
  }
  
  await context.env.DB.prepare(
    "UPDATE students SET name = ? WHERE id = ?"
  ).bind(name.trim(), studentId).run();
  
  return Response.json({ id: studentId, name: name.trim() });
}

export async function onRequestDelete(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const url = new URL(context.request.url);
  const studentId = url.searchParams.get("studentId");
  const classId = url.searchParams.get("classId");
  
  if (!studentId || !classId) {
    return new Response("studentId and classId parameters are required", { status: 400 });
  }
  
  await ensureClassOwnership(context, teacher.id, classId);
  
  // Verify the student belongs to the class
  const { results: studentCheck } = await context.env.DB.prepare(
    "SELECT id FROM students WHERE id = ? AND class_id = ?"
  ).bind(studentId, classId).all();
  
  if (!studentCheck.length) {
    return new Response("Student not found in this class", { status: 404 });
  }
  
  await context.env.DB.prepare("DELETE FROM students WHERE id = ?").bind(studentId).run();
  
  return Response.json({ success: true });
}

// Helper function
async function ensureClassOwnership(context, teacherId, classId) {
  const { results } = await context.env.DB.prepare(
    "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
  ).bind(classId, teacherId).all();
  
  if (!results.length) {
    throw new Response("Class not found or access denied", { status: 403 });
  }
}
