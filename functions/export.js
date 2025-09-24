import { getTeacherFromSession } from "./utils/session.js";

export async function onRequestGet({ request, env }) {
  const teacher = await getTeacherFromSession(request, env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const recitaId = url.searchParams.get("recitaId");

  console.log("Export request - recitaId:", recitaId, "classId:", classId);

  try {
    if (recitaId) {
      return await exportRecitaCSV(env, teacher, recitaId);
    } else if (classId) {
      return await exportClassCSV(env, teacher, classId);
    } else {
      return await exportAllDataCSV(env, teacher);
    }
  } catch (error) {
    console.error('Export error:', error);
    return new Response(`Export failed: ${error.message}`, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  const teacher = await getTeacherFromSession(request, env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  try {
    const { recitaIds } = await request.json();

    if (!recitaIds || !Array.isArray(recitaIds) || recitaIds.length === 0) {
      return new Response("No recita IDs provided", { status: 400 });
    }

    // Verify all recitas belong to teacher
    const placeholders = recitaIds.map(() => '?').join(',');
    const verifyQuery = `
      SELECT r.id FROM recita_sessions r
      JOIN classes c ON r.class_id = c.id
      WHERE r.id IN (${placeholders}) AND c.teacher_id = ?
    `;
    
    const { results: verification } = await env.DB.prepare(verifyQuery)
      .bind(...recitaIds, teacher.id).all();
    
    if (verification.length !== recitaIds.length) {
      return new Response("Some recitas not found or access denied", { status: 403 });
    }

    // Get all data for selected recitas
    const dataQuery = `
      SELECT 
        rs.id as recita_id,
        rs.topic,
        rs.created_at,
        c.name as class_name,
        s.name as student_name,
        a.score,
        a.created_at as picked_at
      FROM recita_sessions rs
      JOIN classes c ON rs.class_id = c.id
      LEFT JOIN attendance a ON rs.id = a.recita_id
      LEFT JOIN students s ON a.student_id = s.id
      WHERE rs.id IN (${placeholders})
      ORDER BY rs.created_at DESC, a.created_at ASC
    `;

    const { results } = await env.DB.prepare(dataQuery)
      .bind(...recitaIds).all();

    // Generate CSV
    let csv = "";
    csv += `Selected Recitas Export\n`;
    csv += `Export Date: ${new Date().toLocaleDateString()}\n`;
    csv += `Export Time: ${new Date().toLocaleTimeString()}\n`;
    csv += `Total Recitas: ${recitaIds.length}\n\n`;

    // Group by recitation
    const recitaGroups = {};
    results.forEach(row => {
      const recitaKey = row.recita_id;
      if (!recitaGroups[recitaKey]) {
        recitaGroups[recitaKey] = {
          topic: row.topic,
          created_at: row.created_at,
          class_name: row.class_name,
          students: []
        };
      }
      
      if (row.student_name) {
        recitaGroups[recitaKey].students.push(row);
      }
    });

    // Add each recitation section
    Object.values(recitaGroups).forEach(recita => {
      csv += `=== ${recita.topic} ===\n`;
      csv += `Class: ${recita.class_name}\n`;
      csv += `Date: ${new Date(recita.created_at).toLocaleDateString()}\n`;
      csv += `Time: ${new Date(recita.created_at).toLocaleTimeString()}\n`;
      csv += `Students Called: ${recita.students.length}\n\n`;
      
      if (recita.students.length > 0) {
        csv += "Order,Student Name,Score,Time Called\n";
        
        let order = 1;
        recita.students.forEach(student => {
          const timeFormatted = student.picked_at ? new Date(student.picked_at).toLocaleTimeString() : 'N/A';
          const score = student.score === null ? 'Skip' : (student.score || 'Absent');
          
          csv += `${order},"${student.student_name}","${score}","${timeFormatted}"\n`;
          order++;
        });
      } else {
        csv += "No students called for this recitation\n";
      }
      
      csv += "\n";
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `selected-recitas-${dateStr}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('Export selected error:', error);
    return new Response(`Export failed: ${error.message}`, { status: 500 });
  }
}

async function exportRecitaCSV(env, teacher, recitaId) {
  console.log("Exporting individual recita:", recitaId);

  // First, get recita details and verify ownership
  const recitaQuery = `
    SELECT rs.*, c.name as class_name
    FROM recita_sessions rs
    JOIN classes c ON rs.class_id = c.id
    WHERE rs.id = ? AND c.teacher_id = ?
  `;
  
  const recitaResult = await env.DB.prepare(recitaQuery).bind(recitaId, teacher.id).all();
  
  if (!recitaResult.results || recitaResult.results.length === 0) {
    return new Response("Recitation not found or access denied", { status: 404 });
  }

  const recita = recitaResult.results[0];

  // Check if all students have been called or skipped
  const completionQuery = `
    SELECT 
      COUNT(s.id) as total_students,
      COUNT(CASE WHEN a.score IS NOT NULL THEN 1 END) as scored_students,
      COUNT(CASE WHEN a.score IS NULL AND a.id IS NOT NULL THEN 1 END) as skipped_students,
      COUNT(a.id) as processed_students
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id AND a.recita_id = ?
    WHERE s.class_id = ?
  `;
  
  const completionResult = await env.DB.prepare(completionQuery).bind(recitaId, recita.class_id).all();
  const completion = completionResult.results[0];
  
  console.log("Completion check:", completion);

  // Fixed logic: Check if all students have been processed (called OR skipped)
  const totalProcessed = completion.processed_students || 0;
  if (completion.total_students > totalProcessed) {
    const remaining = completion.total_students - totalProcessed;
    return new Response(
      `Cannot export: ${remaining} student(s) still need to be called. Complete the recitation first.`,
      { status: 400 }
    );
  }

  // Get attendance data - only students who were actually processed
  const dataQuery = `
    SELECT 
      s.name as student_name,
      a.score,
      a.created_at as picked_at
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.recita_id = ?
    ORDER BY a.created_at ASC
  `;
  
  const dataResult = await env.DB.prepare(dataQuery).bind(recitaId).all();
  
  if (!dataResult.results || dataResult.results.length === 0) {
    return new Response("No attendance data found", { status: 404 });
  }

  // Generate CSV
  let csv = "";
  csv += `Recitation Export\n`;
  csv += `Topic: "${recita.topic || 'No Topic'}"\n`;
  csv += `Class: ${recita.class_name}\n`;
  csv += `Date: ${new Date(recita.created_at).toLocaleDateString()}\n`;
  csv += `Time: ${new Date(recita.created_at).toLocaleTimeString()}\n`;
  csv += `Total Students: ${completion.total_students}\n`;
  csv += `Students Processed: ${totalProcessed}\n\n`;
  
  // CSV headers
  csv += "Order,Student Name,Score,Time Called\n";
  
  // Add data rows
  let order = 1;
  for (const row of dataResult.results) {
    const timeFormatted = row.picked_at ? new Date(row.picked_at).toLocaleTimeString() : 'N/A';
    const score = row.score === null ? 'Skip' : (row.score || 'Absent');
    
    csv += `${order},"${row.student_name}","${score}","${timeFormatted}"\n`;
    order++;
  }

  // Add summary
  const calledCount = dataResult.results.filter(r => r.score !== null).length;
  const skippedCount = dataResult.results.filter(r => r.score === null).length;
  
  csv += `\nSummary:\n`;
  csv += `Called: ${calledCount}\n`;
  csv += `Skip: ${skippedCount}\n`;
  csv += `Total Processed: ${dataResult.results.length}\n`;

  // Generate filename - handle edge cases
  const safeTopic = recita.topic ? recita.topic.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') : 'Recitation';
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Recita-${safeTopic}-${dateStr}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

async function exportClassCSV(env, teacher, classId) {
  console.log("Exporting class data:", classId);

  // Verify class ownership
  const classResult = await env.DB.prepare(
    "SELECT name FROM classes WHERE id = ? AND teacher_id = ?"
  ).bind(classId, teacher.id).all();

  if (!classResult.results || classResult.results.length === 0) {
    return new Response("Class not found or access denied", { status: 404 });
  }

  const className = classResult.results[0].name;

  // Get all recitations for this class with attendance data
  const query = `
    SELECT 
      rs.id as recita_id,
      rs.topic,
      rs.created_at,
      s.name as student_name,
      a.score,
      a.created_at as picked_at
    FROM recita_sessions rs
    LEFT JOIN attendance a ON rs.id = a.recita_id
    LEFT JOIN students s ON a.student_id = s.id
    WHERE rs.class_id = ?
    ORDER BY rs.created_at DESC, a.created_at ASC
  `;

  const result = await env.DB.prepare(query).bind(classId).all();

  if (!result.results || result.results.length === 0) {
    return new Response("No recitation data found for this class", { status: 404 });
  }

  // Generate CSV
  let csv = "";
  csv += `Class Export: ${className}\n`;
  csv += `Export Date: ${new Date().toLocaleDateString()}\n`;
  csv += `Export Time: ${new Date().toLocaleTimeString()}\n\n`;

  // Group by recitation
  const recitaGroups = {};
  result.results.forEach(row => {
    if (!row.topic) return; // Skip rows without topics (shouldn't happen)
    
    const recitaKey = `${row.recita_id}_${row.topic}`;
    if (!recitaGroups[recitaKey]) {
      recitaGroups[recitaKey] = {
        id: row.recita_id,
        topic: row.topic,
        created_at: row.created_at,
        students: []
      };
    }
    
    if (row.student_name) { // Only add if there's student data
      recitaGroups[recitaKey].students.push(row);
    }
  });

  // Add each recitation section
  Object.values(recitaGroups).forEach(recita => {
    csv += `=== ${recita.topic} ===\n`;
    csv += `Date: ${new Date(recita.created_at).toLocaleDateString()}\n`;
    csv += `Time: ${new Date(recita.created_at).toLocaleTimeString()}\n`;
    csv += `Students Called: ${recita.students.length}\n\n`;
    
    if (recita.students.length > 0) {
      csv += "Order,Student Name,Score,Time Called\n";
      
      let order = 1;
      recita.students.forEach(student => {
        const timeFormatted = student.picked_at ? new Date(student.picked_at).toLocaleTimeString() : 'N/A';
        const score = student.score === null ? 'Skip' : (student.score || 'Absent');
        
        csv += `${order},"${student.student_name}","${score}","${timeFormatted}"\n`;
        order++;
      });
    } else {
      csv += "No students called for this recitation\n";
    }
    
    csv += "\n";
  });

  // Generate filename - handle edge cases
  const safeClassName = className ? className.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') : 'class';
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `class-${safeClassName}-all-recitations-${dateStr}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

async function exportAllDataCSV(env, teacher) {
  console.log("Exporting all teacher data");

  // Get all attendance data for this teacher
  const query = `
    SELECT 
      rs.topic,
      rs.created_at,
      s.name as student_name, 
      c.name as class_name, 
      a.score,
      a.created_at as picked_at
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    JOIN recita_sessions rs ON a.recita_id = rs.id
    WHERE c.teacher_id = ?
    ORDER BY c.name, rs.created_at DESC, a.created_at ASC
  `;

  const result = await env.DB.prepare(query).bind(teacher.id).all();

  if (!result.results || result.results.length === 0) {
    return new Response("No attendance data found", { status: 404 });
  }

  let csv = "";
  csv += `All Attendance Data Export\n`;
  csv += `Teacher: ${teacher.email || teacher.name || 'Unknown'}\n`;
  csv += `Export Date: ${new Date().toLocaleDateString()}\n`;
  csv += `Total Records: ${result.results.length}\n\n`;

  // CSV headers
  csv += "Student Name,Class,Topic,Score,Date,Time Called\n";

  // Add data rows
  for (const row of result.results) {
    const dateFormatted = row.created_at ? new Date(row.created_at).toLocaleDateString() : '';
    const timeFormatted = row.picked_at ? new Date(row.picked_at).toLocaleTimeString() : '';
    const score = row.score === null ? 'Skip' : (row.score || 'Absent');
    
    csv += `"${row.student_name}","${row.class_name}","${row.topic || 'No Topic'}","${score}","${dateFormatted}","${timeFormatted}"\n`;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `all-attendance-export-${dateStr}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
