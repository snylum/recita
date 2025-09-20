// Very basic wiring – replace with API calls later

document.addEventListener("DOMContentLoaded", () => {
  // Fill date on recita.html
  const dateEl = document.getElementById("recitaDate");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleString();
  }

  // Save Recita → show Pick Student section
  const saveBtn = document.getElementById("saveRecitaBtn");
  const pickSection = document.getElementById("pickSection");
  if (saveBtn && pickSection) {
    saveBtn.addEventListener("click", () => {
      pickSection.classList.remove("hidden");
    });
  }

  // Pick student modal logic
  const modal = document.getElementById("studentModal");
  const pickBtn = document.getElementById("pickStudentBtn");
  const studentName = document.getElementById("selectedStudent");

  if (pickBtn && modal) {
    pickBtn.addEventListener("click", () => {
      // Dummy student for now
      studentName.textContent = "Random Student";
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.classList.contains("scoreBtn")) {
        console.log("Scored:", e.target.dataset.score);
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      }
    });
  }

  // Add Students logic
  const addStudentsBtn = document.getElementById("addStudentsBtn");
  const studentInput = document.getElementById("studentInput");
  const studentList = document.getElementById("studentList");

  if (addStudentsBtn && studentInput && studentList) {
    addStudentsBtn.addEventListener("click", () => {
      const names = studentInput.value.split("\n").map(n => n.trim()).filter(Boolean);
      names.forEach(name => {
        const li = document.createElement("li");
        li.textContent = name;
        li.className = "p-2 border rounded";
        studentList.appendChild(li);
      });
      studentInput.value = "";
    });
  }
});
