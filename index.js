// === src/index.js ===
// Cloudflare Worker (module syntax) — serves SPA and provides a simple KV-backed API.

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      // Route API calls under /api/*
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, env);
      }
      // Otherwise return the SPA HTML
      return new Response(getHtml(), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    } catch (err) {
      return new Response('Server error: ' + err.message, { status: 500 });
    }
  },
};

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', ''); // e.g. /roster
  const kv = env.RANDOM_PICKER; // Requires KV binding named RANDOM_PICKER

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (path === '/roster' && request.method === 'POST') {
    const data = await request.json();
    // data: { key, roster: ["Alice","Bob"], overwrite: bool }
    const key = data.key || 'default';
    const roster = Array.isArray(data.roster) ? data.roster : [];
    await kv.put('roster:' + key, JSON.stringify(roster));
    // initialize session
    const session = roster.map((n) => ({ name: n, attendance: 'unknown', recitation: 0 }));
    await kv.put('session:' + key, JSON.stringify(session));
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders() });
  }

  if (path === '/roster' && request.method === 'GET') {
    const key = url.searchParams.get('key') || 'default';
    const raw = await kv.get('roster:' + key);
    const roster = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify({ roster }), { headers: jsonHeaders() });
  }

  if (path === '/pick' && request.method === 'POST') {
    // pick a random student and optionally record attendance/recitation
    const data = await request.json();
    const key = data.key || 'default';
    const rosterRaw = await kv.get('roster:' + key);
    const roster = rosterRaw ? JSON.parse(rosterRaw) : [];
    if (roster.length === 0) return new Response(JSON.stringify({ error: 'empty roster' }), { status: 400, headers: jsonHeaders() });
    const idx = Math.floor(Math.random() * roster.length);
    const name = roster[idx];

    // load session
    const sessionKey = 'session:' + key;
    const sessionRaw = await kv.get(sessionKey);
    const session = sessionRaw ? JSON.parse(sessionRaw) : roster.map((n) => ({ name: n, attendance: 'unknown', recitation: 0 }));

    // apply optional record
    if (data.record) {
      // data.record: { name, attendance: 'present'|'absent', recitation: number }
      const rec = data.record;
      const entry = session.find((e) => e.name === rec.name);
      if (entry) {
        if (rec.attendance) entry.attendance = rec.attendance;
        if (typeof rec.recitation === 'number') entry.recitation = rec.recitation;
      }
      await kv.put(sessionKey, JSON.stringify(session));
    }

    return new Response(JSON.stringify({ name, index: idx, session }), { headers: jsonHeaders() });
  }

  if (path === '/session' && request.method === 'GET') {
    const key = url.searchParams.get('key') || 'default';
    const sessionRaw = await kv.get('session:' + key);
    const session = sessionRaw ? JSON.parse(sessionRaw) : [];
    return new Response(JSON.stringify({ session }), { headers: jsonHeaders() });
  }

  if (path === '/record' && request.method === 'POST') {
    const data = await request.json();
    const key = data.key || 'default';
    const rec = data.record; // { name, attendance, recitation }
    const sessionKey = 'session:' + key;
    const sessionRaw = await kv.get(sessionKey);
    const session = sessionRaw ? JSON.parse(sessionRaw) : [];
    const entry = session.find((e) => e.name === rec.name);
    if (entry) {
      if (rec.attendance) entry.attendance = rec.attendance;
      if (typeof rec.recitation === 'number') entry.recitation = rec.recitation;
      await kv.put(sessionKey, JSON.stringify(session));
      return new Response(JSON.stringify({ ok: true, session }), { headers: jsonHeaders() });
    }
    return new Response(JSON.stringify({ error: 'student not found' }), { status: 404, headers: jsonHeaders() });
  }

  if (path === '/export' && request.method === 'GET') {
    const key = url.searchParams.get('key') || 'default';
    const sessionRaw = await kv.get('session:' + key);
    const session = sessionRaw ? JSON.parse(sessionRaw) : [];
    const csv = toCsv(session);
    return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8' } });
  }

  return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: jsonHeaders() });
}

function jsonHeaders() {
  return Object.assign(corsHeaders(), { 'content-type': 'application/json; charset=utf-8' });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,HEAD,POST,OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  };
}

function toCsv(session) {
  const rows = ['Name,Attendance,Recitation'];
  for (const r of session) rows.push(`"${r.name.replace(/"/g, '""')}",${r.attendance},${r.recitation}`);
  return rows.join('\n');
}

function getHtml() {
  // Simple SPA: upload roster, pick student, record attendance/recitation, export CSV
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Random Picker + Attendance</title>
<style>
  body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:16px;background:#f7f9fc}
  .card{background:white;border-radius:8px;padding:16px;box-shadow:0 2px 6px rgba(0,0,0,0.08);max-width:900px;margin:12px auto}
  textarea{width:100%;height:120px}
  button{padding:8px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer}
  .big{font-size:28px;font-weight:700;margin:12px 0}
  table{width:100%;border-collapse:collapse}
  td,th{padding:8px;border-bottom:1px solid #eee}
</style>
</head>
<body>
  <div class="card">
    <h2>Random Name / Group Picker + Attendance</h2>
    <p>Paste one student name per line, then <strong>Save Roster</strong>.</p>
    <textarea id="rosterInput" placeholder="Alice\nBob\nCharlie"></textarea>
    <div style="margin-top:8px">
      <button id="saveRosterBtn">Save Roster</button>
      <button id="loadRosterBtn">Load Roster</button>
      <button id="exportBtn">Export CSV</button>
    </div>
  </div>

  <div class="card">
    <div style="display:flex;gap:12px;align-items:center">
      <div class="big" id="picked">—</div>
      <div style="flex:1">
        <button id="pickBtn">Pick Student</button>
        <button id="presentBtn">Mark Present</button>
        <button id="absentBtn">Mark Absent</button>
      </div>
      <div>
        <label>Recitation pts: <input id="recPts" type="number" value="5" style="width:80px" /></label>
        <button id="givePtsBtn">Give Points</button>
      </div>
    </div>
    <hr />
    <h3>Session</h3>
    <div id="sessionArea">No session loaded.</div>
  </div>

<script>
const API = '/api';
const KEY = 'default';

async function saveRoster() {
  const raw = document.getElementById('rosterInput').value.trim();
  const roster = raw.split('\n').map(s=>s.trim()).filter(Boolean);
  await fetch(API + '/roster', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ key: KEY, roster }) });
  await loadSession();
}

async function loadRoster() {
  const res = await fetch(API + '/roster?key=' + KEY);
  const data = await res.json();
  document.getElementById('rosterInput').value = (data.roster || []).join('\n');
  await loadSession();
}

async function pickStudent() {
  const res = await fetch(API + '/pick', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ key: KEY }) });
  const data = await res.json();
  if (data.error) return alert(data.error);
  document.getElementById('picked').textContent = data.name;
  renderSession(data.session);
}

async function recordAttendance(name, attendance) {
  const res = await fetch(API + '/record', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ key: KEY, record: { name, attendance } }) });
  const data = await res.json();
  renderSession(data.session);
}

async function givePoints(name, pts) {
  const res = await fetch(API + '/record', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ key: KEY, record: { name, recitation: Number(pts) } }) });
  const data = await res.json();
  renderSession(data.session);
}

async function loadSession() {
  const res = await fetch(API + '/session?key=' + KEY);
  const data = await res.json();
  renderSession(data.session);
}

function renderSession(session) {
  if (!session || session.length === 0) { document.getElementById('sessionArea').innerHTML = '<em>No students.</em>'; return; }
  const rows = ['<table><tr><th>Name</th><th>Attendance</th><th>Recitation</th><th>Actions</th></tr>'];
  for (const s of session) {
    rows.push('<tr>' +
      `<td>${escapeHtml(s.name)}</td>` +
      `<td>${escapeHtml(s.attendance)}</td>` +
      `<td>${s.recitation}</td>` +
      `<td>` +
      `<button onclick="markPresent('${escapeJs(s.name)}')">Present</button>` +
      `<button onclick="markAbsent('${escapeJs(s.name)}')">Absent</button>` +
      `<button onclick="givePtsPrompt('${escapeJs(s.name)}')">Give pts</button>` +
      `</td></tr>`);
  }
  rows.push('</table>');
  document.getElementById('sessionArea').innerHTML = rows.join('');
}

function escapeHtml(text){ return text.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt','>':'&gt','"':'&quot;'}[c]||c)); }
function escapeJs(text){ return text.replace(/'/g, "\\'"); }

window.markPresent = (name) => recordAttendance(name, 'present');
window.markAbsent = (name) => recordAttendance(name, 'absent');
window.givePtsPrompt = (name) => {
  const v = prompt('Points for ' + name + '?', '5');
  if (v !== null) givePoints(name, Number(v));
}

document.getElementById('saveRosterBtn').addEventListener('click', saveRoster);
document.getElementById('loadRosterBtn').addEventListener('click', loadRoster);
document.getElementById('pickBtn').addEventListener('click', pickStudent);
document.getElementById('presentBtn').addEventListener('click', ()=>{ const n = document.getElementById('picked').textContent; if (n && n !== '—') recordAttendance(n,'present'); });
document.getElementById('absentBtn').addEventListener('click', ()=>{ const n = document.getElementById('picked').textContent; if (n && n !== '—') recordAttendance(n,'absent'); });
document.getElementById('givePtsBtn').addEventListener('click', ()=>{ const n = document.getElementById('picked').textContent; const pts = document.getElementById('recPts').value; if (n && n !== '—') givePoints(n, Number(pts)); });

document.getElementById('exportBtn').addEventListener('click', ()=>{ window.open(API + '/export?key=' + KEY, '_blank'); });

// load roster on open
loadRoster();

</script>
</body>
</html>`;
}
