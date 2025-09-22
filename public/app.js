// app.js
// ======================================================
// Shared Helpers
// ======================================================

// Guest modal system (single source of truth)
function showModal(contentHtml) {
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-96 relative">
      <button id="closeModalBtn" class="absolute top-2 right-2 text-gray-500 hover:text-gray-700">&times;</button>
      <div class="modal-body">${contentHtml}</div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#closeModalBtn").addEventListener("click", () => {
    modal.remove();
  });
}

function downloadCSV(filename, rows) {
  const processRow = (row) =>
    row
      .map((val) => `"${String(val).replace(/"/g, '""')}"`)
      .join(",");
  const csvContent =
    rows.map(processRow).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.click();
  URL.revokeObjectURL(url);
}

// ======================================================
// Recita Icon Helper (Authenticated Mode Only)
// ======================================================
function renderRecitaLabel(text = "Recita") {
  return `<img src="icon.png" alt="icon" class="inline w-5 h-5 mr-1 align-middle"> ${text}`;
}

// ======================================================
// Authenticated Mode Logic
// ======================================================

// Attach Recita icon beside text in authenticated pages
function replaceRecitaLabels() {
  if (window.location.pathname.includes("/recita") || window.location.pathname.includes("class.html")) {
    document.querySelectorAll("*").forEach((el) => {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
        if (el.textContent.trim() === "Recita" || el.textContent.trim().includes("Recita")) {
          el.innerHTML = el.textContent.replace(/Recita/g, renderRecitaLabel("Recita"));
        }
      }
      if (el.tagName === "BUTTON" || el.tagName === "A") {
        el.innerHTML = el.innerHTML.replace(/Recita/g, renderRecitaLabel("Recita"));
      }
    });
  }
}

// Save Recita in /recita page
function setupSaveRecita() {
  const btn = document.getElementById("saveRecitaBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const topic = document.getElementById("topicInput").value.trim();
    const date = document.getElementById("recitaDate").textContent;

    if (!topic) {
      showModal("<p class='text-center text-red-500'>Please enter a topic.</p>");
      return;
    }

    // Save Recita (mock localStorage for demo)
    const recitas = JSON.parse(localStorage.getItem("recitas") || "[]");
    recitas.push({ topic, date, students: [] });
    localStorage.setItem("recitas", JSON.stringify(recitas));

    showModal(`<p class="text-center font-bold">${renderRecitaLabel()} saved!</p>`);
    document.getElementById("pickSection").classList.remove("hidden");
  });
}

// Pick Student modal in /recita page
function setupPickStudent() {
  const btn = document.getElementById("pickStudentBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const recitas = JSON.parse(localStorage.getItem("recitas") || "[]");
    if (recitas.length === 0) {
      showModal("<p class='text-center text-red-500'>No Recita found. Save one first.</p>");
      return;
    }

    // Mock student pick (replace with actual list)
    const students = ["Alice", "Bob", "Charlie", "Dana"];
    const chosen = students[Math.floor(Math.random() * students.length)];

    showModal(`
      <h2 class="text-xl font-bold mb-4">${chosen}</h2>
      <div class="flex flex-col gap-2">
        <button class="scoreBtn bg-blue-500 text-white p-2 rounded" data-score="5">+5 Points</button>
        <button class="scoreBtn bg-blue-600 text-white p-2 rounded" data-score="10">+10 Points</button>
        <button class="scoreBtn bg-gray-500 text-white p-2 rounded" data-score="skip">Skip</button>
        <button class="scoreBtn bg-red-500 text-white p-2 rounded" data-score="absent">Absent</button>
      </div>
    `);

    document.querySelectorAll(".scoreBtn").forEach((b) => {
      b.addEventListener("click", () => {
        const score = b.dataset.score;
        recitas[recitas.length - 1].students.push({ name: chosen, score });
        localStorage.setItem("recitas", JSON.stringify(recitas));
        document.querySelector(".fixed.inset-0").remove();
      });
    });
  });
}

// ======================================================
// Export Recitas to CSV (Class Dashboard)
// ======================================================
function setupExportButtons() {
  if (!window.location.pathname.includes("class.html")) return;

  // Add export buttons dynamically under each class card
  document.querySelectorAll(".class-card").forEach((card, idx) => {
    const btn = document.createElement("button");
    btn.className =
      "mt-2 bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600";
    btn.innerHTML = `Export ${renderRecitaLabel("Recitas")} to CSV 📂`;
    card.appendChild(btn);

    btn.addEventListener("click", () => {
      const recitas = JSON.parse(localStorage.getItem("recitas") || "[]");
      if (recitas.length === 0) {
        showModal("<p class='text-center text-red-500'>No Recitas saved for this class.</p>");
        return;
      }

      // Build checkbox list
      const listHtml = recitas
        .map(
          (r, i) => `
          <label class="flex items-center gap-2">
            <input type="checkbox" value="${i}" class="recitaCheckbox">
            <span>${r.date} — ${r.topic}</span>
          </label>
        `
        )
        .join("");

      showModal(`
        <h2 class="text-lg font-bold mb-4">${renderRecitaLabel("Export Recitas")}</h2>
        <div class="space-y-2 mb-4">${listHtml}</div>
        <button id="confirmExportBtn" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Export Selected</button>
      `);

      document.getElementById("confirmExportBtn").addEventListener("click", () => {
        const selected = Array.from(document.querySelectorAll(".recitaCheckbox:checked")).map(
          (cb) => recitas[parseInt(cb.value)]
        );

        if (selected.length === 0) {
          alert("Select at least one Recita to export.");
          return;
        }

        const rows = [["Date", "Topic", "Student", "Score"]];
        selected.forEach((r) => {
          if (r.students.length === 0) {
            rows.push([r.date, r.topic, "-", "-"]);
          } else {
            r.students.forEach((s) => {
              rows.push([r.date, r.topic, s.name, s.score]);
            });
          }
        });

        downloadCSV("recitas_export.csv", rows);
        document.querySelector(".fixed.inset-0").remove();
      });
    });
  });
}

// ======================================================
// Init
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  replaceRecitaLabels();
  setupSaveRecita();
  setupPickStudent();
  setupExportButtons();
});
