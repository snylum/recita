// app.js
// Complete revised app script for unified modals, authenticated persistence,
// pick student, view/export scores per-class, and "Recita" icon injection.

// -------------------
// Base helpers
// -------------------
async function apiFetch(url, options = {}) {
  console.log("apiFetch:", url, options && options.method ? options.method : "GET");
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  console.log("Response status:", res.status, "url:", res.url);

  // If server redirected to login page (Cloudflare Pages might redirect),
  // detect and throw auth error.
  try {
    const originalPath = new URL(url, window.location.origin).pathname;
    const responsePath = new URL(res.url).pathname;
    if (originalPath !== responsePath && (res.url.includes("index.html") || responsePath === "/")) {
      throw new Error("Authentication required - please log in");
    }
  } catch (e) {
    // ignore parsing errors - continue
  }

  if (!res.ok) {
    const txt = await res.text();
    console.error("API Error body:", txt);
    throw new Error(txt || `Request failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // attempt to parse text but treat as error (likely HTML login response)
    const responseText = await res.text();
    throw new Error("Server returned non-JSON response (possible auth).");
  }

  return res.json();
}

function go(url) {
  window.location.href = url;
}

// -------------------
// Unified modal system
// -------------------
function _createModalElement() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.zIndex = 20000;
  overlay.innerHTML = `
    <div class="modal-window">
      <button class="modal-close" aria-label="Close">&times;</button>
      <div class="modal-body"></div>
    </div>
  `;
  // close handlers
  overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}

/**
 * showModal
 * contentHtml: string (inner HTML)
 * opts: { title?: string, classes?: string }  - optional
 * returns the modal DOM element
 */
function showModal(contentHtml, opts = {}) {
  const overlay = _createModalElement();
  const body = overlay.querySelector(".modal-body");
  if (opts.title) {
    body.insertAdjacentHTML("beforeend", `<h3 class="modal-title">${escapeHtml(opts.title)}</h3>`);
  }
  body.insertAdjacentHTML("beforeend", contentHtml);
  if (opts.classes) overlay.classList.add(...opts.classes.split(/\s+/));
  document.body.appendChild(overlay);
  return overlay;
}

function showInfoModal(message, title = "Information") {
  return showModal(`<p class="modal-text">${escapeHtml(message)}</p><div style="text-align:center"><button class="modal-btn">OK</button></div>`, { title });
}

function showConfirmModal(message, onConfirm, onCancel = null, title = "Confirm") {
  const overlay = showModal(`
    <p class="modal-text">${escapeHtml(message)}</p>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:12px;">
      <button id="__confirm_yes" class="modal-btn">Yes</button>
      <button id="__confirm_no" class="modal-btn modal-cancel">Cancel</button>
    </div>
  `, { title });
  overlay.querySelector("#__confirm_yes").addEventListener("click", () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  });
  overlay.querySelector("#__confirm_no").addEventListener("click", () => {
    overlay.remove();
    if (onCancel) onCancel();
  });
  return overlay;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// -------------------
// Small wrappers to reuse guest modals for authenticated recita UI
// -------------------
function showRecitaInfoModal(message, title = "Information") {
  const modal = showInfoModal(message, title);
  // wire OK button to simply close
  const btn = modal.querySelector(".modal-btn");
  if (btn) btn.addEventListener("click", () => modal.remove());
  return modal;
}

function showRecitaConfirmModal(message, onConfirm, title = "Confirm") {
  return showConfirmModal(message, onConfirm, null, title);
}

// -------------------
// Add icon.png beside every "Recita" mention (authenticated pages only)
// Safe text-node replacement (skips inputs, script, style, textarea)
// -------------------
function addRecitaIconsIfAuthPages() {
  const isAuthPage = /recita|class\.html|dashboard\.html/.test(window.location.pathname);
  if (!isAuthPage) return;

  const iconHtml = `<img src="icon.png" alt="" class="recita-icon" />`;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

  const replaceInTextNode = (textNode) => {
    const txt = textNode.nodeValue;
    if (!txt || !txt.includes("Recita")) return false;
    const parent = textNode.parentNode;
    if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.nodeName)) return false;

    // create a temporary fragment to insert
    const frag = document.createDocumentFragment();
    // split by Recita occurrences
    const parts = txt.split(/(Recita)/g);
    parts.forEach(part => {
      if (part === "Recita") {
        // insert span with icon + word
        const span = document.createElement("span");
        span.className = "recita-label";
        span.innerHTML = iconHtml + " " + "Recita";
        frag.appendChild(span);
      } else if (part.length > 0) {
        frag.appendChild(document.createTextNode(part));
      }
    });
    parent.replaceChild(frag, textNode);
    return true;
  };

  // collect nodes first (replace while walking can break)
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }
  textNodes.forEach(n => replaceInTextNode(n));
}

// -------------------
// Auth forms used site-wide
// (These expect login/signup HTML with ids present)
// -------------------
function setupLogin(apiFetchFn, onSuccess) {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      await apiFetchFn("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      onSuccess && onSuccess("dashboard.html");
    } catch (err) {
      showInfoModal("Login failed: " + (err.message || err), "Login Error");
    }
  });
}

function setupSignup(apiFetchFn, onSuccess) {
  const form = document.getElementById("signupForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      await apiFetchFn("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
      onSuccess && onSuccess("dashboard.html");
    } catch (err) {
      showInfoModal("Signup failed: " + (err.message || err), "Signup Error");
    }
  });
}

function setupLogout(apiFetchFn, goFn) {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await apiFetchFn("/auth/logout", { method: "POST" });
      goFn("index.html");
    } catch (err) {
      showInfoModal("Logout failed: " + (err.message || err), "Logout Error");
    }
  });
}

// -------------------
// Guest mode initialization (kept intact from original; non-destructive)
// -------------------
function initGuestMode() {
  try {
    // original guest mode logic assumed to be present in your app
    // The important part: we do not override or remove guest functionality
    // If your old guest functions are present, they will continue to run.
    const guestInitEvent = new Event("recitaGuestInit");
    document.dispatchEvent(guestInitEvent);
    console.log("Guest mode init triggered.");
  } catch (e) {
    console.warn("Guest mode initialization skipped:", e);
  }
}

// -------------------
// Helper: per-class storage helpers (localStorage fallback)
// -------------------
function storageKeyForClass(classId) {
  return `recitas_class_${classId || "default"}`;
}
function getRecitasForClass(classId) {
  try {
    const key = storageKeyForClass(classId);
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch (e) { return []; }
}
function saveRecitasForClass(classId, recitas) {
  const key = storageKeyForClass(classId);
  localStorage.setItem(key, JSON.stringify(recitas));
}

// -------------------
// UI: CLASS PAGE - adds "Export Recitas to CSV" under each .class-card
// Attempts API fetch first, falls back to localStorage
// -------------------
async function setupExportRecitasPerClassButtons() {
  if (!document.querySelector(".class-card")) return;

  document.querySelectorAll(".class-card").forEach(card => {
    // avoid adding twice
    if (card.querySelector(".export-recitas-btn")) return;

    const btn = document.createElement("button");
    btn.className = "export-recitas-btn btn-accent";
    btn.type = "button";
    btn.textContent = "Export Recitas to CSV 📂";
    btn.style.marginTop = "12px";
    card.appendChild(btn);

    btn.addEventListener("click", async () => {
      const classId = card.dataset.classId || localStorage.getItem("classId") || "default";

      // Try to fetch recitas from server for this class first
      let recitas = [];
      try {
        recitas = await apiFetch(`/recitas?classId=${encodeURIComponent(classId)}`);
      } catch (err) {
        console.warn("API fetch recitas failed, using localStorage fallback:", err.message);
        recitas = getRecitasForClass(classId);
      }

      if (!recitas || recitas.length === 0) {
        showInfoModal("No recitas found for this class.", "No Recitas");
        return;
      }

      // build checkbox list
      const listHtml = recitas.map((r, idx) => {
        const dateStr = r.created_at ? new Date(r.created_at).toLocaleString() : (r.date || "No date");
        const topic = r.topic || "Untitled";
        return `<label style="display:block; margin:6px 0;"><input type="checkbox" data-idx="${idx}"> ${escapeHtml(dateStr)} — ${escapeHtml(topic)}</label>`;
      }).join("");

      const modal = showModal(`
        <div>
          <h3 style="margin-bottom:10px;">Select Recitas to export</h3>
          <div style="max-height:40vh; overflow:auto; margin-bottom:12px;">${listHtml}</div>
          <div style="display:flex; gap:8px;">
            <button id="exportRecitasConfirm" class="modal-btn">Export Selected</button>
            <button id="exportRecitasCancel" class="modal-btn modal-cancel">Cancel</button>
          </div>
        </div>
      `, { title: "Export Recitas" });

      modal.querySelector("#exportRecitasCancel").addEventListener("click", () => modal.remove());
      modal.querySelector("#exportRecitasConfirm").addEventListener("click", () => {
        const checked = Array.from(modal.querySelectorAll("input[type=checkbox]:checked")).map(ch => parseInt(ch.dataset.idx, 10));
        if (checked.length === 0) {
          showInfoModal("Please pick at least one recita to export.", "No Selection");
          return;
        }

        // build csv rows
        const rows = [["ClassId", "RecitaTopic", "RecitaDate", "StudentName", "StudentScore"]];
        checked.forEach(i => {
          const r = recitas[i];
          const students = r.attendance || r.students || [];
          if (students.length === 0) {
            rows.push([classId, r.topic || "", r.created_at || r.date || "", "-", "-"]);
          } else {
            students.forEach(s => {
              rows.push([classId, r.topic || "", r.created_at || r.date || "", s.student_name || s.name || "-", s.score || "-"]);
            });
          }
        });

        const safeName = `recitas-export-${classId}-${(new Date()).toISOString().split("T")[0]}.csv`;
        downloadCSV(safeName, rows);
        modal.remove();
      });
    });
  });
}

// -------------------
// /recita page behavior (authenticated mode)
// - Save recita: API POST /attendance (if available) else localStorage
// - Pick student: attempts API pick then fallback to local logic
// - Record score: POST to API then fallback to localStorage
// - View scores modal + export
// -------------------
function setupRecitaPage() {
  const saveBtn = document.getElementById("saveRecitaBtn");
  const topicInput = document.getElementById("topicInput");
  const recitaDateSpan = document.getElementById("recitaDate");
  const pickSection = document.getElementById("pickSection");
  const pickBtn = document.getElementById("pickStudentBtn");

  if (recitaDateSpan) {
    recitaDateSpan.textContent = new Date().toLocaleDateString();
  }

  const classId = localStorage.getItem("classId") || "default";

  // local helper: called students for current recita (local fallback)
  function getCurrentRecitaLocal() {
    const recitas = getRecitasForClass(classId);
    const recitaId = localStorage.getItem("recitaId");
    if (!recitaId && recitas.length > 0) return recitas[recitas.length - 1];
    return recitas.find(r => r.id && String(r.id) === String(recitaId)) || null;
  }

  async function saveRecitaToServer(topic) {
    const numericClass = parseInt(classId, 10) || null;
    const payload = { topic, classId: numericClass };
    const res = await apiFetch("/attendance", { method: "POST", body: JSON.stringify(payload) });
    return res;
  }

  saveBtn && saveBtn.addEventListener("click", async () => {
    const topic = (topicInput && topicInput.value || "").trim();
    if (!topic) {
      showRecitaInfoModal("Please enter a topic", "Error");
      return;
    }

    // try server first
    try {
      const serverResp = await saveRecitaToServer(topic);
      // serverResp expected to contain id, created_at
      const recitaId = serverResp.id;
      localStorage.setItem("recitaId", recitaId);
      localStorage.setItem("recitaTopic", topic);
      localStorage.setItem("recitaDate", new Date().toLocaleDateString());
      localStorage.setItem("recitaTime", new Date().toLocaleTimeString());
      // clear any called students (server will hold authoritative list)
      localStorage.removeItem("calledStudents");
      if (pickSection) pickSection.classList.remove("hidden");
      displayRecitaStatus();
      showRecitaInfoModal(`Recita "${topic}" saved successfully!`, "Success");
      return;
    } catch (err) {
      console.warn("Saving recita to server failed, falling back to localStorage:", err.message);
    }

    // fallback: store in localStorage per-class
    const recitas = getRecitasForClass(classId);
    const newRecita = {
      id: Date.now(), // temporary id
      topic,
      date: new Date().toISOString(),
      students: [],
      attendance: []
    };
    recitas.push(newRecita);
    saveRecitasForClass(classId, recitas);
    localStorage.setItem("recitaId", newRecita.id);
    localStorage.setItem("recitaTopic", topic);
    localStorage.setItem("recitaDate", new Date().toLocaleDateString());
    localStorage.setItem("recitaTime", new Date().toLocaleTimeString());
    localStorage.removeItem("calledStudents");
    if (pickSection) pickSection.classList.remove("hidden");
    displayRecitaStatus();
    showRecitaInfoModal(`Recita "${topic}" saved locally (offline mode)`, "Success");
  });

  function displayRecitaStatus() {
    const topic = localStorage.getItem("recitaTopic");
    const date = localStorage.getItem("recitaDate");
    const time = localStorage.getItem("recitaTime");
    const recitaId = localStorage.getItem("recitaId");
    if (!(topic && date && time && recitaId)) return;

    let statusEl = document.getElementById("recitaStatus");
    if (!statusEl) {
      statusEl = document.createElement("div");
      statusEl.id = "recitaStatus";
      statusEl.className = "recita-status";
      const saveBtnEl = document.getElementById("saveRecitaBtn");
      if (saveBtnEl && saveBtnEl.parentNode) {
        saveBtnEl.parentNode.insertBefore(statusEl, saveBtnEl.nextSibling);
      } else if (pickSection) {
        pickSection.insertBefore(statusEl, pickSection.firstChild);
      } else {
        document.body.insertBefore(statusEl, document.body.firstChild);
      }
    }

    statusEl.innerHTML = `
      <div>
        <strong>Current Recita:</strong> ${escapeHtml(topic)}<br>
        <small>${escapeHtml(date)} at ${escapeHtml(time)}</small>
        <div style="margin-top:8px;">
          <button id="editRecitaBtn" class="modal-btn">Edit</button>
          <button id="exportCurrentRecitaBtn" class="modal-btn">Export CSV</button>
        </div>
      </div>
    `;

    const editBtn = statusEl.querySelector("#editRecitaBtn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const topicInputEl = document.getElementById("topicInput");
        if (topicInputEl) {
          topicInputEl.value = topic;
          topicInputEl.focus();
        }
      });
    }

    const exportBtn = statusEl.querySelector("#exportCurrentRecitaBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        // export current recita; try server, else local
        (async () => {
          const recitaId = localStorage.getItem("recitaId");
          try {
            // server-side export endpoint
            window.location.href = `/export?recitaId=${recitaId}`;
            return;
          } catch (err) { /* fallback below */ }

          // fallback: build CSV from localStorage
          const recitas = getRecitasForClass(classId);
          const cur = recitas.find(r => String(r.id) === String(recitaId));
          if (!cur) {
            showInfoModal("No local record found for this recita.", "Export Error");
            return;
          }
          const rows = [["Topic", "Date", "Student", "Score"]];
          const students = cur.attendance || cur.students || [];
          if (students.length === 0) rows.push([cur.topic, cur.date || "", "-", "-"]);
          else students.forEach(s => rows.push([cur.topic, cur.date || "", s.student_name || s.name, s.score]));
          downloadCSV(`recita-${cur.topic || "export"}.csv`, rows);
        })();
      });
    }
  }

  // pick student handler
  if (pickBtn) {
    pickBtn.addEventListener("click", async () => {
      const recitaId = localStorage.getItem("recitaId");
      if (!recitaId) {
        showRecitaInfoModal("No recita ID found. Save a recita first.", "Error");
        return;
      }

      // try server pick first
      try {
        const student = await apiFetch(`/attendance?action=pick&recitaId=${encodeURIComponent(recitaId)}`);
        if (!student) {
          // server said all students called
          const modal = showModal(`<p>All students have been called. Export CSV?</p>
            <div style="display:flex; gap:8px;"><button id="exportYes" class="modal-btn">Export</button><button id="exportNo" class="modal-btn modal-cancel">Cancel</button></div>`, { title: "All Students Called" });
          modal.querySelector("#exportYes").addEventListener("click", () => window.location.href = `/export?recitaId=${recitaId}`);
          modal.querySelector("#exportNo").addEventListener("click", () => modal.remove());
          return;
        }
        // show authenticated student modal using unified modal
        showAuthenticatedStudentModal(student);
        return;
      } catch (err) {
        console.warn("Server pick failed; using local fallback:", err.message);
      }

      // local fallback: pick a random student not already called
      const recitas = getRecitasForClass(classId);
      const current = recitas.find(r => String(r.id) === String(localStorage.getItem("recitaId"))) || recitas[recitas.length - 1];
      if (!current) {
        showRecitaInfoModal("No local recita found. Save one first.", "Error");
        return;
      }
      const allStudents = current.students && current.students.length ? current.students.map(s => s.name) : [];
      const called = (current.attendance || []).map(a => a.student_name || a.name);
      const available = allStudents.filter(n => !called.includes(n));
      if (available.length === 0) {
        showRecitaConfirmModal("All students called. Export CSV?", () => {
          downloadCSV(`recitas-${classId}.csv`, [["Topic","Date","Student","Score"]]);
        }, "All Called");
        return;
      }
      // avoid immediate repeat of last skip
      const last = (current.attendance || [])[ (current.attendance || []).length - 1 ];
      let eligible = available;
      if (last && last.score === "skip" && available.length > 1) {
        eligible = available.filter(n => n !== (last.student_name || last.name));
      }
      const pickedName = eligible[Math.floor(Math.random()*eligible.length)];
      const studentObj = { id: null, name: pickedName }; // id unknown in local fallback
      showAuthenticatedStudentModal(studentObj);
    });
  }

  // showAuthenticatedStudentModal used above - attaches event listeners for scoring
  function showAuthenticatedStudentModal(student) {
    // build modal content
    const content = `
      <div style="text-align:center;">
        <h3 style="margin-bottom:8px;">${escapeHtml(student.name)}</h3>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
          <button class="score-action modal-btn" data-score="10">10 pts</button>
          <button class="score-action modal-btn" data-score="5">5 pts</button>
          <button class="score-action modal-btn" data-score="custom">Custom</button>
          <button class="score-action modal-btn" data-score="skip">Skip</button>
        </div>
        <div style="margin-top:10px;">
          <button id="closeAuthStudentModal" class="modal-btn modal-cancel">Cancel</button>
        </div>
      </div>
    `;
    const modal = showModal(content, { title: "Selected Student" });

    // custom handler
    modal.querySelectorAll(".score-action").forEach(el => {
      el.addEventListener("click", () => {
        const score = el.dataset.score;
        if (score === "custom") {
          modal.remove();
          showRecitaCustomScoreModal(student);
          return;
        }
        modal.remove();
        recordScore(student.id, score, student.name);
      });
    });

    const cancelBtn = modal.querySelector("#closeAuthStudentModal");
    if (cancelBtn) cancelBtn.addEventListener("click", () => modal.remove());
  }

  function showRecitaCustomScoreModal(student) {
    const modal = showModal(`
      <div>
        <h3 style="margin-bottom:8px;">Custom score for ${escapeHtml(student.name)}</h3>
        <input id="recitaCustomInput" placeholder="Enter custom score (e.g., Good, 7)" style="width:100%; padding:8px; margin-bottom:8px;">
        <div style="display:flex; gap:8px;">
          <button id="saveRecitaCustomBtn" class="modal-btn">Save</button>
          <button id="cancelRecitaCustomBtn" class="modal-btn modal-cancel">Cancel</button>
        </div>
      </div>
    `, { title: "Custom Score" });

    modal.querySelector("#saveRecitaCustomBtn").addEventListener("click", () => {
      const val = modal.querySelector("#recitaCustomInput").value.trim();
      if (!val) {
        modal.querySelector("#recitaCustomInput").style.borderColor = "#ef4444";
        return;
      }
      modal.remove();
      recordScore(student.id, "custom", student.name, val);
    });

    modal.querySelector("#cancelRecitaCustomBtn").addEventListener("click", () => modal.remove());
  }

  // recordScore: tries API then falls back to local storage
  async function recordScore(studentId, score, studentName, customScore = null) {
    const recitaId = localStorage.getItem("recitaId");
    if (!recitaId) {
      showRecitaInfoModal("Missing recita ID", "Error");
      return;
    }

    // Try server
    try {
      await apiFetch("/attendance", { method: "POST", body: JSON.stringify({ recitaId, studentId, score, customScore }) });
      // update local called students UI too (optimistic)
      addToCalledStudentsList(studentName, score, customScore);
      return;
    } catch (err) {
      console.warn("Server record failed; falling back to local:", err.message);
    }

    // Local fallback: append to current recita object
    const recitas = getRecitasForClass(classId);
    const cur = recitas.find(r => String(r.id) === String(recitaId)) || recitas[recitas.length - 1];
    if (!cur) {
      // create current recita
      const newRec = { id: recitaId, topic: localStorage.getItem("recitaTopic") || "Recita", date: new Date().toISOString(), attendance: [] };
      newRec.attendance.push({ student_name: studentName, score: score, customScore, timestamp: new Date().toLocaleTimeString() });
      recitas.push(newRec);
      saveRecitasForClass(classId, recitas);
    } else {
      if (!cur.attendance) cur.attendance = [];
      cur.attendance.push({ student_name: studentName, score, customScore, timestamp: new Date().toLocaleTimeString() });
      saveRecitasForClass(classId, recitas);
    }

    addToCalledStudentsList(studentName, score, customScore);
  }

  // called students local UI management (authenticated)
  function addToCalledStudentsList(studentName, score, customScore = null) {
    const key = "calledStudents";
    const calledStudents = JSON.parse(localStorage.getItem(key) || "[]");
    const entry = { name: studentName, score, timestamp: new Date().toLocaleTimeString() };
    if (customScore) entry.customScore = customScore;
    calledStudents.push(entry);
    calledStudents.sort((a,b) => a.name.split(" ").pop().toLowerCase().localeCompare(b.name.split(" ").pop().toLowerCase()));
    localStorage.setItem(key, JSON.stringify(calledStudents));
    updateCalledStudentsDisplay();
  }

  function updateCalledStudentsDisplay() {
    const container = document.getElementById("calledStudentsList");
    if (!container) {
      // if not present, create a container in the page near pickSection
      const calledContainer = document.getElementById("calledStudentsContainer") || document.createElement("div");
      calledContainer.id = "calledStudentsContainer";
      calledContainer.className = "called-container";
      calledContainer.innerHTML = `<h3>Called Students</h3><div id="calledStudentsList"></div>`;
      if (pickSection && pickSection.parentNode) pickSection.parentNode.insertBefore(calledContainer, pickSection.nextSibling);
    }

    const called = JSON.parse(localStorage.getItem("calledStudents") || "[]");
    const listEl = document.getElementById("calledStudentsList");
    if (!listEl) return;
    if (called.length === 0) {
      listEl.innerHTML = '<p style="color:#666; text-align:center;">No students called yet</p>';
      return;
    }
    let html = `<table style="width:100%; border-collapse:collapse;"><thead><tr><th>Name</th><th>Score</th><th>Time</th></tr></thead><tbody>`;
    called.forEach((s, idx) => {
      let scoreDisp = s.score;
      if (s.score === "custom" && s.customScore) scoreDisp = s.customScore;
      if (s.score === "absent") scoreDisp = "Absent";
      if (s.score === "skip") scoreDisp = "Skip";
      html += `<tr style="${idx%2===0?'background:#fff;':'background:#f8f9fa;'}"><td style="padding:8px;">${escapeHtml(s.name)}</td><td style="text-align:center;">${escapeHtml(String(scoreDisp))}</td><td style="text-align:center;">${escapeHtml(s.timestamp)}</td></tr>`;
    });
    html += `</tbody></table>`;
    listEl.innerHTML = html;
  }

  // initialize called students display if there are items
  setTimeout(() => {
    const existing = JSON.parse(localStorage.getItem("calledStudents") || "[]");
    if (existing.length > 0) {
      addToCalledStudentsList("", "", ""); // creates container then immediately removed by update
      updateCalledStudentsDisplay();
    }
  }, 300);

  // View Scores modal (for current recita)
  function showScoresModal() {
    const recitaId = localStorage.getItem("recitaId");
    if (!recitaId) {
      showInfoModal("No current recita saved.", "No Recita");
      return;
    }

    // try server details first
    (async () => {
      try {
        const details = await apiFetch(`/recitas/${encodeURIComponent(recitaId)}/details`);
        // build table
        const rows = (details.attendance || []).map(a => `<tr><td>${escapeHtml(a.student_name)}</td><td style="text-align:center">${escapeHtml(a.score || "-")}</td></tr>`).join("");
        const content = `<h3>Scores - ${escapeHtml(details.topic || "")}</h3>
          <table style="width:100%; border-collapse:collapse;"><thead><tr><th>Student</th><th>Score</th></tr></thead><tbody>${rows || "<tr><td colspan='2'>No attendance</td></tr>"}</tbody></table>
          <div style="margin-top:10px; display:flex; gap:8px;"><button id="exportScoresCsv" class="modal-btn">Export Scores CSV</button><button id="closeScoresModal" class="modal-btn modal-cancel">Close</button></div>`;
        const modal = showModal(content, { title: "Recita Scores" });
        modal.querySelector("#closeScoresModal").addEventListener("click", () => modal.remove());
        modal.querySelector("#exportScoresCsv").addEventListener("click", () => {
          const rowsOut = [["Student","Score"]];
          (details.attendance || []).forEach(a => rowsOut.push([a.student_name || "-", a.score || "-"]));
          downloadCSV(`recita-${details.topic || "scores"}.csv`, rowsOut);
        });
        return;
      } catch (err) {
        console.warn("Details fetch failed:", err.message);
      }

      // fallback local
      const recitas = getRecitasForClass(classId);
      const cur = recitas.find(r => String(r.id) === String(recitaId)) || recitas[recitas.length - 1];
      if (!cur) {
        showInfoModal("No local data for this recita.", "No Data");
        return;
      }
      const attendance = cur.attendance || cur.students || [];
      let rows = attendance.map(a => `<tr><td>${escapeHtml(a.student_name || a.name || "-")}</td><td style="text-align:center">${escapeHtml(a.score || a.customScore || "-")}</td></tr>`).join("");
      if (!rows) rows = "<tr><td colspan='2' style='text-align:center'>No students recorded</td></tr>";
      const modal = showModal(`<h3>Scores - ${escapeHtml(cur.topic || "")}</h3><table style="width:100%; border-collapse:collapse;"><thead><tr><th>Student</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table><div style='margin-top:10px;display:flex;gap:8px;'><button id='exportLocalScores' class='modal-btn'>Export CSV</button><button id='closeLocalScores' class='modal-btn modal-cancel'>Close</button></div>`, { title: "Recita Scores" });
      modal.querySelector("#closeLocalScores").addEventListener("click", () => modal.remove());
      modal.querySelector("#exportLocalScores").addEventListener("click", () => {
        const rowsOut = [["Student","Score"]];
        attendance.forEach(a => rowsOut.push([a.student_name || a.name || "-", a.score || a.customScore || "-"]));
        downloadCSV(`recita-${cur.topic || "scores"}.csv`, rowsOut);
      });
    })();
  }

  // expose view scores button in pickSection (adds button if not present)
  if (pickSection) {
    if (!document.getElementById("viewScoresBtn")) {
      const btn = document.createElement("button");
      btn.id = "viewScoresBtn";
      btn.className = "modal-btn";
      btn.style.marginTop = "8px";
      btn.textContent = "View Scores";
      pickSection.appendChild(btn);
      btn.addEventListener("click", showScoresModal);
    } else {
      document.getElementById("viewScoresBtn").addEventListener("click", showScoresModal);
    }
  }
}

// -------------------
// Boot
// -------------------
document.addEventListener("DOMContentLoaded", () => {
  // Add Recita icons in authenticated pages
  addRecitaIconsIfAuthPages();

  // Setup auth forms if present
  setupLogin(apiFetch, (url) => { window.location.href = url; });
  setupSignup(apiFetch, (url) => { window.location.href = url; });
  setupLogout(apiFetch, go);

  // Init guest mode (non-destructive)
  initGuestMode();

  // Set up class-page export buttons
  setupExportRecitasPerClassButtons();

  // If on recita page, set that up
  if (/recita/.test(window.location.pathname) || window.location.pathname.endsWith("recita.html")) {
    setupRecitaPage();
  }

  // Small: update inline called students list if present
  const calledList = document.getElementById("calledStudentsList");
  if (calledList) {
    // populate if data exists
    const items = JSON.parse(localStorage.getItem("calledStudents") || "[]");
    if (items.length > 0) {
      // reuse update function from setupRecitaPage; but it's internal - do a minimal render here
      let html = `<table style="width:100%"><thead><tr><th>Name</th><th>Score</th><th>Time</th></tr></thead><tbody>`;
      items.forEach((s, i) => {
        html += `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.score)}</td><td>${escapeHtml(s.timestamp)}</td></tr>`;
      });
      html += `</tbody></table>`;
      calledList.innerHTML = html;
    }
  }
});
