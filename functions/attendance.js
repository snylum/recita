import { getTeacherFromSession } from "./utils/session.js";

export async function onRequestPost(context) {
  try {
    const teacher = await getTeacherFromSession(context.request, context.env);
    if (!teacher) return new Response("Unauthorized", { status: 401 });

    const body = await context.request.json();
    console.log("POST /attendance received body:", body);

    // Case 1: Create recita session
    if (body.topic && body.classId) {
      const ownership = await ensureClassOwnership(context, teacher.id, body.classId);
      if (ownership !== true) return ownership;

      console.log("Creating recita session for:", { classId: body.classId, topic: body.topic, teacherId: teacher.id });

      const result = await context.env.DB.prepare(
        "INSERT INTO recita_sessions (class_id, topic, created_at) VALUES (?, ?, datetime('now'))"
      ).bind(body.classId, body.topic).run();

      console.log("D1 insert result:", result);

      // Get the insert ID from D1 result
      let insertId = null;
      if (result?.meta?.last_row_id) {
        insertId = result.meta.last_row_id;
      } else if (result?.meta?.lastRowId) {
        insertId = result.meta.lastRowId;
      } else if (result?.lastRowId) {
        insertId = result.lastRowId;
      }

      if (!insertId) {
        console.error("No insert ID found in D1 result:", JSON.stringify(result, null, 2));
        return new Response(JSON.stringify({ 
          error: "Failed to get insert ID",
          debug: result,
          message: "Database insert succeeded but ID not returned"
        }), { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      const response = {
        id: insertId,
        topic: body.topic,
        classId: body.classId,
        teacherId: teacher.id,
        created_at: new Date().toISOString()
      };

      return Response.json(response);
    }

    // Case 2: Mark attendance/score
    if (body.recitaId && body.studentId) {
      console.log("Recording attendance:", { recitaId: body.recitaId, studentId: body.studentId, score: body.score });
      
      await context.env.DB.prepare(
        "INSERT INTO attendance (recita_id, student_id, score) VALUES (?, ?, ?)"
      ).bind(body.recitaId, body.studentId, body.score || null).run();

      return Response.json({ ok: true });
    }

    console.log("Invalid request body:", body);
    return new Response("Bad request", { status: 400 });
  } catch (error) {
    console.error("POST /attendance error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message,
      stack: error.stack
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// NEW: PUT method for updating recita topics
export async function onRequestPut(context) {
  try {
    const teacher = await getTeacherFromSession(context.request, context.env);
    if (!teacher) return new Response("Unauthorized", { status: 401 });

    const body = await context.request.json();
    console.log("PUT /attendance received body:", body);

    // Update recita topic
    if (body.recitaId && body.topic) {
      // First, verify the recita exists and belongs to teacher's class
      const { results: recitaCheck } = await context.env.DB.prepare(`
        SELECT rs.id, rs.class_id, rs.topic
        FROM recita_sessions rs
        JOIN classes c ON rs.class_id = c.id
        WHERE rs.id = ? AND c.teacher_id = ?
      `).bind(body.recitaId, teacher.id).all();

      if (!recitaCheck.length) {
        return new Response("Recita session not found or access denied", { status: 404 });
      }

      // Update the topic
      await context.env.DB.prepare(
        "UPDATE recita_sessions SET topic = ? WHERE id = ?"
      ).bind(body.topic.trim(), body.recitaId).run();

      console.log("Successfully updated recita topic:", { recitaId: body.recitaId, newTopic: body.topic });

      return Response.json({ 
        success: true,
        id: body.recitaId,
        topic: body.topic.trim(),
        message: "Recita topic updated successfully"
      });
    }

    return new Response("Bad request - missing recitaId or topic", { status: 400 });
  } catch (error) {
    console.error("PUT /attendance error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message,
      stack: error.stack
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const action = url.searchParams.get("action");
    const recitaId = url.searchParams.get("recitaId");
    const classId = url.searchParams.get("classId");

    console.log("GET attendance - action:", action, "recitaId:", recitaId, "classId:", classId);

    // Handle getting recita details with attendance records
    if (action === "getDetails" && recitaId) {
      const teacher = await getTeacherFromSession(context.request, context.env);
      if (!teacher) return new Response("Unauthorized", { status: 401 });

      console.log("Getting recita details for ID:", recitaId);

      // Get recita details with attendance records
      const { results: recitaDetails } = await context.env.DB.prepare(`
        SELECT 
          rs.id,
          rs.topic,
          rs.class_id,
          rs.created_at,
          c.name as class_name
        FROM recita_sessions rs
        JOIN classes c ON rs.class_id = c.id
        WHERE rs.id = ? AND c.teacher_id = ?
      `).bind(recitaId, teacher.id).all();

      if (!recitaDetails.length) {
        return new Response("Recita session not found or access denied", { status: 404 });
      }

      const recita = recitaDetails[0];

      // Get attendance records for this recita
      const { results: attendanceRecords } = await context.env.DB.prepare(`
        SELECT 
          a.id,
          a.student_id,
          a.score,
          a.created_at,
          s.name as student_name
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.recita_id = ?
        ORDER BY s.name
      `).bind(recitaId).all();

      const response = {
        id: recita.id,
        topic: recita.topic,
        class_id: recita.class_id,
        class_name: recita.class_name,
        created_at: recita.created_at,
        attendance: attendanceRecords
      };

      return Response.json(response);
    }

    // Handle getting recitas for a class
    if (action === "getRecitas" || url.searchParams.get("getRecitas")) {
      const teacher = await getTeacherFromSession(context.request, context.env);
      if (!teacher) return new Response("Unauthorized", { status: 401 });

      if (!classId) {
        return new Response("Missing classId parameter", { status: 400 });
      }

      const ownership = await ensureClassOwnership(context, teacher.id, classId);
      if (ownership !== true) return ownership;

      console.log("Getting recitas for class:", classId);

      // Get all recita sessions for this class with student count
      const { results } = await context.env.DB.prepare(`
        SELECT 
          rs.id,
          rs.class_id,
          rs.topic,
          rs.created_at,
          COUNT(a.id) as student_count
        FROM recita_sessions rs
        LEFT JOIN attendance a ON rs.id = a.recita_id
        WHERE rs.class_id = ?
        GROUP BY rs.id, rs.class_id, rs.topic, rs.created_at
        ORDER BY rs.created_at DESC
      `).bind(classId).all();

      console.log("Found recitas:", results);
      return Response.json(results);
    }

    // Handle /attendance/pick or /attendance?action=pick
    if (url.pathname.endsWith("/pick") || action === "pick") {
      const teacher = await getTeacherFromSession(context.request, context.env);
      if (!teacher) return new Response("Unauthorized", { status: 401 });

      if (!recitaId) {
        return new Response("Missing recitaId parameter", { status: 400 });
      }

      // Find class for this recita session
      const { results: recitaRows } = await context.env.DB.prepare(
        "SELECT class_id FROM recita_sessions WHERE id = ?"
      ).bind(recitaId).all();

      if (!recitaRows.length) {
        return new Response("Recita session not found", { status: 404 });
      }

      const classId = recitaRows[0].class_id;
      const ownership = await ensureClassOwnership(context, teacher.id, classId);
      if (ownership !== true) return ownership;

      // Get students not yet marked for this recita
      const { results } = await context.env.DB.prepare(`
        SELECT s.id, s.name 
        FROM students s
        WHERE s.class_id = ?
        AND s.id NOT IN (SELECT student_id FROM attendance WHERE recita_id = ?)
      `).bind(classId, recitaId).all();

      if (!results.length) {
        return Response.json(null); // All students marked
      }

      // Pick random student
      const random = results[Math.floor(Math.random() * results.length)];
      return Response.json(random);
    }

    // Default GET response
    return Response.json({ 
      message: "Attendance endpoint is working", 
      availableActions: ["pick", "getRecitas"],
      usage: "Use ?action=pick&recitaId=X to pick a random student, or ?action=getRecitas&classId=X to get recita list"
    });
  } catch (error) {
    console.error("GET /attendance error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message,
      stack: error.stack
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// DELETE method for deleting recita sessions
export async function onRequestDelete(context) {
  try {
    const teacher = await getTeacherFromSession(context.request, context.env);
    if (!teacher) return new Response("Unauthorized", { status: 401 });

    const url = new URL(context.request.url);
    const recitaId = url.searchParams.get("recitaId");

    if (!recitaId) {
      return new Response("Missing recitaId parameter", { status: 400 });
    }

    console.log("Deleting recita session:", recitaId);

    // First, verify the recita exists and belongs to teacher's class
    const { results: recitaCheck } = await context.env.DB.prepare(`
      SELECT rs.id, rs.class_id
      FROM recita_sessions rs
      JOIN classes c ON rs.class_id = c.id
      WHERE rs.id = ? AND c.teacher_id = ?
    `).bind(recitaId, teacher.id).all();

    if (!recitaCheck.length) {
      return new Response("Recita session not found or access denied", { status: 404 });
    }

    // Delete attendance records first (foreign key constraint)
    await context.env.DB.prepare("DELETE FROM attendance WHERE recita_id = ?").bind(recitaId).run();

    // Then delete the recita session
    await context.env.DB.prepare("DELETE FROM recita_sessions WHERE id = ?").bind(recitaId).run();

    console.log("Successfully deleted recita session:", recitaId);
    return Response.json({ success: true });

  } catch (error) {
    console.error("DELETE /attendance error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message,
      stack: error.stack
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Helper function for class ownership verification
async function ensureClassOwnership(context, teacherId, classId) {
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    ).bind(classId, teacherId).all();

    if (!results.length) {
      console.log("Class ownership check failed - teacherId:", teacherId, "classId:", classId);
      return new Response("Forbidden - You don't own this class", { status: 403 });
    }

    return true;
  } catch (error) {
    console.error("ensureClassOwnership error:", error);
    return new Response("Database error", { status: 500 });
  }
}
