let currentStudent = null;

// Pick a random student
async function pickStudent() {
  const res = await fetch("/api/attendance/pick");
  const data = await res.json();
  if (!data || !data.id) {
    alert("No students found.");
    return;
  }
  currentStudent = data;
  document.getElementById("popup-student-name").textContent = data.name;
  document.getElementById("popup-class-name").textContent = `Class: ${data.class}`;
  document.getElementById("popup").style.display = "flex";
}

// Mark attendance and close popup
async function markAttendance(status, points) {
  if (!currentStudent) return;

  await fetch("/api/attendance/mark", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      student_id: currentStudent.id,
      status,
      points
    })
  });

  document.getElementById("popup").style.display = "none";
  currentStudent = null;
  loadClasses(); // optional refresh
}
