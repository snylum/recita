import { getTeacherFromSession } from "../../utils/session.js";

export async function onRequestDelete(context) {
  const teacher = await getTeacherFromSession(context.request, context.env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  
  const recitaId = context.params.id;
  
  // Verify ownership through class
  const verifyQuery = `
    SELECT r.id FROM recita_sessions r
    JOIN classes c ON r.class_id = c.id
    WHERE r.id = ? AND c.teacher_id = ?
  `;
  
  const { results } = await context.env.DB.prepare(verifyQuery)
    .bind(recitaId, teacher.id).all();
  
  if (!results.length) {
    return new Response("Recita not found or access denied", { status: 404 });
  }
  
  // Delete attendance records first (foreign key constraint)
  await context.env.DB.prepare("DELETE FROM attendance WHERE recita_id = ?")
    .bind(recitaId).run();
  
  // Then delete the recita session
  await context.env.DB.prepare("DELETE FROM recita_sessions WHERE id = ?")
    .bind(recitaId).run();
  
  return Response.json({ success: true });
}
