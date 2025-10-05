import { getTeacherFromSession } from "./utils/session.js";

export async function onRequestGet(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  // Get classes with students in one query using LEFT JOIN
  const { results } = await context.env.DB.prepare(`
    SELECT 
      c.id as class_id, 
      c.name as class_name,
      s.id as student_id,
      s.name as student_name
    FROM classes c
    LEFT JOIN students s ON c.id = s.class_id
    WHERE c.teacher_id = ?
    ORDER BY c.name, s.name
  `).bind(teacher.id).all();
  
  // Group the results by class
  const classesMap = new Map();
  
  results.forEach(row => {
    if (!classesMap.has(row.class_id)) {
      classesMap.set(row.class_id, {
        id: row.class_id,
        name: row.class_name,
        students: []
      });
    }
    
    // Only add student if they exist (LEFT JOIN might return null students)
    if (row.student_id) {
      classesMap.get(row.class_id).students.push({
        id: row.student_id,
        name: row.student_name
      });
    }
  });
  
  return Response.json(Array.from(classesMap.values()));
}

export async function onRequestPost(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const { name } = await context.request.json();
  
  if (!name || !name.trim()) {
    return new Response("Class name is required", { status: 400 });
  }
  
  const { lastRowId } = await context.env.DB.prepare(
    "INSERT INTO classes (teacher_id, name) VALUES (?, ?)"
  ).bind(teacher.id, name.trim()).run();
  
  return Response.json({ 
    id: lastRowId, 
    name: name.trim(),
    students: [] // New class starts with no students
  });
}

export async function onRequestDelete(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const url = new URL(context.request.url);
  const classId = url.searchParams.get("classId");
  
  if (!classId) {
    return new Response("classId parameter is required", { status: 400 });
  }
  
  // Verify ownership before deletion
  const { results } = await context.env.DB.prepare(
    "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
  ).bind(classId, teacher.id).all();
  
  if (!results.length) {
    return new Response("Class not found or access denied", { status: 403 });
  }
  
  // Delete students first (foreign key constraint)
  await context.env.DB.prepare("DELETE FROM students WHERE class_id = ?").bind(classId).run();
  
  // Then delete the class
  await context.env.DB.prepare("DELETE FROM classes WHERE id = ?").bind(classId).run();
  
  return Response.json({ success: true });
}
