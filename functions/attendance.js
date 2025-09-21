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
      if (ownership !== true) return ownership; // Return the error response

      console.log("Creating recita session for:", { classId: body.classId, topic: body.topic, teacherId: teacher.id });

      const result = await context.env.DB.prepare(
        "INSERT INTO recita_sessions (class_id, topic, created_at) VALUES (?, ?, datetime('now'))"
      ).bind(body.classId, body.topic).run();

      console.log("D1 insert result:", result);
      console.log("D1 result structure:", Object.keys(result || {}));

      // D1 returns the insert ID in different ways depending on the version
      // Try multiple approaches to get the ID
      let insertId = null;

      // Method 1: Check result.meta.last_row_id (most common)
      if (result && result.meta && result.meta.last_row_id) {
        insertId = result.meta.last_row_id;
        console.log("Found ID in result.meta.last_row_id:", insertId);
      }
      // Method 2: Check result.meta.lastRowId
      else if (result && result.meta && result.meta.lastRowId) {
        insertId = result.meta.lastRowId;
        console.log("Found ID in result.meta.lastRowId:", insertId);
      }
      // Method 3: Check direct result.lastRowId (your original code)
      else if (result && result.lastRowId) {
        insertId = result.lastRowId;
        console.log("Found ID in result.lastRowId:", insertId);
      }
      // Method 4: Check result.changes.last_insert_rowid
      else if (result && result.changes && result.changes.last_insert_rowid) {
        insertId = result.changes.last_insert_rowid;
        console.log("Found ID in result.changes.last_insert_rowid:", insertId);
      }

      console.log("Final insertId:", insertId);

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

      console.log("Returning response:", response);
      return Response.json(response);
    }

    console.log("Invalid request body:", body);
    return new Response("Bad request", { status: 400 });
  } catch (error) {
    console.error("POST /attendance error:", error);
    console.error("Error stack:", error.stack);
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

export async function onRequestPatch(context) {
  try {
    const teacher = await getTeacherFromSession(context.request, context.env);
    if (!teacher) return new Response("Unauthorized", { status: 401 });

    const body = await context.request.json();
    console.log("PATCH /attendance received body:", body);
    
    if (body.recitaId && body.topic) {
      // First verify the teacher owns this recita session
      const { results: recitaRows } = await context.env.DB.prepare(
        "SELECT class_id FROM recita_sessions WHERE id = ?"
      ).bind(body.recitaId).all();

      if (!recitaRows.length) {
        return new Response("Recita session not found", { status: 404 });
      }

      const classId = recitaRows[0].class_id;
      const ownership = await ensureClassOwnership(context, teacher.id, classId);
      if (ownership !== true) return ownership;

      // Update recita topic
      console.log("Updating recita topic:", body.recitaId, "to:", body.topic);
      
      const result = await context.env.DB.prepare(
        "UPDATE recita_sessions SET topic = ? WHERE id = ?"
      ).bind(body.topic, body.recitaId).run();

      console.log("Update result:", result);

      if (result.success) {
        return Response.json({ 
          success: true, 
          message: "Topic updated successfully",
          topic: body.topic
        });
      } else {
        return Response.json({ 
          success: false, 
          error: "Failed to update topic" 
        }, { status: 500 });
      }
    }

    return Response.json({ 
      success: false, 
      error: "Missing recitaId or topic" 
    }, { status: 400 });

  } catch (err) {
    console.error("PATCH attendance error:", err);
    return Response.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  try {
    const teacher = await getTeacherFromSession(context.request, context.env);
    if (!teacher) return new Response("Unauthorized", { status: 401 });

    const body = await context.request.json();
    console.log("PUT /attendance received body:", body);

    if (body.studentId && body.recitaId) {
      // Verify the teacher owns this recita session
      const { results: recitaRows } = await context.env.DB.prepare(
        "SELECT class_id FROM recita_sessions WHERE id = ?"
      ).bind(body.recitaId).all();

      if (!recitaRows.length) {
        return new Response("Recita session not found", { status: 404 });
      }

      const classId = recitaRows[0].class_id;
      const ownership = await ensureClassOwnership(context, teacher.id, classId);
      if (ownership !== true) return ownership;

      console.log("Recording attendance:", { 
        recitaId: body.recitaId, 
        studentId: body.studentId, 
        score: body.score, 
        status: body.status 
      });
      
      // Check if attendance record already exists
      const { results: existingRecords } = await context.env.DB.prepare(
        "SELECT id FROM attendance WHERE recita_id = ? AND student_id = ?"
      ).bind(body.recitaId, body.studentId).all();

      let result;
      
      if (existingRecords.length > 0) {
        // Update existing record
        result = await context.env.DB.prepare(`
          UPDATE attendance 
          SET score = ?, status = ?, picked_at = datetime('now')
          WHERE recita_id = ? AND student_id = ?
        `).bind(
          body.score, 
          body.status || 'called',
          body.recitaId, 
          body.studentId
        ).run();
      } else {
        // Insert new record
        result = await context.env.DB.prepare(`
          INSERT INTO attendance (recita_id, student_id, score, status, picked_at) 
          VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(
          body.recitaId, 
          body.studentId, 
          body.score, 
          body.status || 'called'
        ).run();
      }

      if (result.success) {
        return Response.json({ 
          success: true,
          message: "Attendance recorded successfully"
        });
      } else {
        return Response.json({ 
          success: false, 
          error: "Failed to record attendance" 
        }, { status: 500 });
      }
    }

    return Response.json({ 
      success: false, 
      error: "Missing studentId or recitaId" 
    }, { status: 400 });

  } catch (err) {
    console.error("PUT attendance error:", err);
    return Response.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
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

      // Students not yet marked - ensure we return student with ID
      const { results } = await context.env.DB.prepare(`
        SELECT s.id, s.name 
        FROM students s
        WHERE s.class_id = ?
        AND s.id NOT IN (SELECT student_id FROM attendance WHERE recita_id = ?)
        ORDER BY s.name
      `).bind(classId, recitaId).all();

      console.log("Found", results.length, "unmarked students");

      if (!results.length) {
        console.log("All students already marked");
        return Response.json({ 
          student: null, 
          message: "All students have been called!" 
        });
      }

      const random = results[Math.floor(Math.random() * results.length)];
      console.log("Picked random student:", random);
      
      // Ensure the student object has both id and name
      if (!random.id || !random.name) {
        console.error("Invalid student data:", random);
        return Response.json({ 
          error: "Invalid student data retrieved",
          debug: random 
        }, { status: 500 });
      }
      
      return Response.json({ student: random });
    }

    // Get recita details and students for display
    if (recitaId) {
      const teacher = await getTeacherFromSession(context.request, context.env);
      if (!teacher) return new Response("Unauthorized", { status: 401 });

      // Get recita info
      const { results: recitaRows } = await context.env.DB.prepare(
        "SELECT * FROM recita_sessions WHERE id = ?"
      ).bind(recitaId).all();

      if (!recitaRows.length) {
        return Response.json({ error: "Recita not found" }, { status: 404 });
      }

      const recita = recitaRows[0];
      const ownership = await ensureClassOwnership(context, teacher.id, recita.class_id);
      if (ownership !== true) return ownership;

      // Get all students for this class with their attendance status
      const { results: students } = await context.env.DB.prepare(`
        SELECT 
          s.id,
          s.name,
          a.score,
          a.status,
          a.picked_at
        FROM students s
        LEFT JOIN attendance a ON s.id = a.student_id AND a.recita_id = ?
        WHERE s.class_id = ?
        ORDER BY a.picked_at ASC, s.name ASC
      `).bind(recitaId, recita.class_id).all();

      return Response.json({
        recita: {
          id: recita.id,
          topic: recita.topic,
          date: recita.created_at
        },
        students: students
      });
    }

    // Default response for GET /attendance (for testing)
    console.log("GET /attendance - no action specified");
    return Response.json({ message: "Attendance endpoint is working", availableActions: ["pick"] });
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
