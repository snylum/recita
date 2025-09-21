import { getTeacherFromSession } from "./utils/session.js";

export async function onRequestPost(context) {
  try {
    const teacher = await getTeacherFromSession(context.request, context.env);
    if (!teacher) return new Response("Unauthorized", { status: 401 });

    const body = await context.request.json();

    // Case 1: Create recita session
    if (body.topic && body.classId) {
      const ownership = await ensureClassOwnership(context, teacher.id, body.classId);
      if (ownership !== true) return ownership; // Return the error response

      const { lastRowId } = await context.env.DB.prepare(
        "INSERT INTO recita_sessions (class_id, topic, created_at) VALUES (?, ?, datetime('now'))"
      ).bind(body.classId, body.topic).run();

      return Response.json({ id: lastRowId, topic: body.topic });
    }

    // Case 2: Mark attendance/score
    if (body.recitaId && body.studentId) {
      await context.env.DB.prepare(
        "INSERT INTO attendance (recita_id, student_id, score) VALUES (?, ?, ?)"
      ).bind(body.recitaId, body.studentId, body.score).run();

      return Response.json({ ok: true });
    }

    return new Response("Bad request", { status: 400 });
  } catch (error) {
    console.error("POST /attendance error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    console.log("GET attendance - pathname:", url.pathname, "search:", url.searchParams.toString());

    const action = url.searchParams.get("action");
    const recitaId = url.searchParams.get("recitaId");

    // Handle both /attendance/pick?recitaId=X and /attendance?action=pick&recitaId=X
    if (url.pathname.endsWith("/pick") || action === "pick") {
      const teacher = await getTeacherFromSession(context.request, context.env);
      if (!teacher) return new Response("Unauthorized", { status: 401 });

      console.log("Pick request for recitaId:", recitaId);

      if (!recitaId) {
        return new Response("Missing recitaId parameter", { status: 400 });
      }

      // Find class for this recita session
      const { results: recitaRows } = await context.env.DB.prepare(
        "SELECT class_id FROM recita_sessions WHERE id = ?"
      ).bind(recitaId).all();

      if (!recitaRows.length) {
        console.log("No recita found with id:", recitaId);
        return new Response("Recita session not found", { status: 404 });
      }

      const classId = recitaRows[0].class_id;
      console.log("Found classId:", classId, "for recita:", recitaId);

      const ownership = await ensureClassOwnership(context, teacher.id, classId);
      if (ownership !== true) return ownership; // Return the error response

      // Students not yet marked
      const { results } = await context.env.DB.prepare(`
        SELECT s.id, s.name 
        FROM students s
        WHERE s.class_id = ?
        AND s.id NOT IN (SELECT student_id FROM attendance WHERE recita_id = ?)
      `).bind(classId, recitaId).all();

      console.log("Found", results.length, "unmarked students");

      if (!results.length) {
        console.log("All students already marked");
        return Response.json(null);
      }

      const random = results[Math.floor(Math.random() * results.length)];
      console.log("Picked random student:", random);
      return Response.json(random);
    }

    // Default response for GET /attendance (for testing)
    console.log("GET /attendance - no action specified");
    return Response.json({ message: "Attendance endpoint is working", availableActions: ["pick"] });
  } catch (error) {
    console.error("GET /attendance error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

// Helpers
async function ensureClassOwnership(context, teacherId, classId) {
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    ).bind(classId, teacherId).all();

    if (!results.length) {
      console.log("Class ownership check failed - teacherId:", teacherId, "classId:", classId);
      return new Response("Forbidden - You don't own this class", { status: 403 });
    }

    return true; // Success
  } catch (error) {
    console.error("ensureClassOwnership error:", error);
    return new Response("Database error", { status: 500 });
  }
}
