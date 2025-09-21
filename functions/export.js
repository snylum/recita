import { getTeacherFromSession } from "./utils/session.js";

export async function onRequestGet({ request, env }) {
  const teacher = await getTeacherFromSession(request, env);
  if (!teacher) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const recitaId = url.searchParams.get("recitaId");

  let query, params, filename;

  if (recitaId) {
    // Export specific recitation session
    query = `
      SELECT 
        r.topic,
        r.date,
        r.time,
        s.name as student_name, 
        a.score, 
        a.created_at,
        c.name as class_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      JOIN recitations r ON a.recita_id = r.id
      WHERE r.id = ? AND c.teacher_id = ?
      ORDER BY s.name
    `;
    params = [recitaId, teacher.id];
    filename = "recitation-export.csv";
  } else if (classId) {
    // Export all data for a specific class
    query = `
      SELECT 
        r.topic,
        r.date,
        r.time,
        s.name as student_name, 
        c.name as class_name, 
        a.score, 
        a.created_at
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN recitations r ON a.recita_id = r.id
      WHERE c.id = ? AND c.teacher_id = ?
      ORDER BY a.created_at DESC, s.name
    `;
    params = [classId, teacher.id];
    filename = "class-attendance-export.csv";
  } else {
    // Export all data for the teacher
    query = `
      SELECT 
        r.topic,
        r.date,
        r.time,
        s.name as student_name, 
        c.name as class_name, 
        a.score, 
        a.created_at
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN recitations r ON a.recita_id = r.id
      WHERE c.teacher_id = ?
      ORDER BY c.name, a.created_at DESC, s.name
    `;
    params = [teacher.id];
    filename = "all-attendance-export.csv";
  }

  try {
    const rows = await env.DB.prepare(query).bind(...params).all();
    
    if (!rows.results || rows.results.length === 0) {
      return new Response("No data found for export", { status: 404 });
    }

    let csv = "";
    
    // If this is a single recitation export, add header info
    if (recitaId && rows.results.length > 0) {
      const firstRow = rows.results[0];
      csv += `Recitation Export\n`;
      csv += `Topic: "${firstRow.topic || 'No Topic'}"\n`;
      csv += `Date: ${firstRow.date || 'No Date'}\n`;
      csv += `Time: ${firstRow.time || 'No Time'}\n`;
      csv += `Class: ${firstRow.class_name}\n\n`;
      
      // Generate filename with topic
      if (firstRow.topic) {
        const safeTopic = firstRow.topic.replace(/[^a-zA-Z0-9]/g, '-');
        filename = `recitation-${safeTopic}-${firstRow.date || 'unknown'}.csv`;
      }
    }

    // Add CSV headers
    if (recitaId) {
      csv += "Student Name,Score,Time Called\n";
    } else {
      csv += "Student Name,Class,Topic,Score,Date,Time\n";
    }

    // Add data rows
    for (const row of rows.results) {
      let scoreDisplay = row.score || "";
      
      // Format score display
      if (row.score === 'absent') {
        scoreDisplay = "Absent";
      } else if (row.score === 'skip') {
        scoreDisplay = "Skip";
      } else if (row.score && !isNaN(row.score)) {
        scoreDisplay = row.score + " pts";
      }

      if (recitaId) {
        // Single recitation format
        const timeOnly = row.created_at ? new Date(row.created_at).toLocaleTimeString() : '';
        csv += `"${row.student_name}","${scoreDisplay}","${timeOnly}"\n`;
      } else {
        // Multi-recitation format
        const fullDate = row.created_at ? new Date(row.created_at).toLocaleDateString() : '';
        csv += `"${row.student_name}","${row.class_name}","${row.topic || 'No Topic'}","${scoreDisplay}","${fullDate}","${row.time || ''}"\n`;
      }
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return new Response("Export failed", { status: 500 });
  }
}
