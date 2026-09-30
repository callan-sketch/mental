/* Competition Mindset — shared app code
   Local-first: everything is saved on the phone first, then queued and sent
   to Google Sheets through the Apps Script web app when there's a connection. */

const CONFIG = {
  // Paste your Apps Script web app URL here (ends in /exec). Leave empty to run without sync.
  SCRIPT_URL: "",
  // Must match APP_KEY in Code.gs. Not real security — see README.
  APP_KEY: "change-me",
  // YouTube video IDs per week (the part after v= in the link). Empty shows a placeholder.
  VIDEOS: { 1: "" },
  // Shown in the help box on the home page.
  HELP_CONTACT: "Talk to your coach or a parent. Referral contact: to be added.",
  PROGRAMME_WEEKS: 8
};

const WEEKS = [
  { n: 1, title: "Your competition brain" },
  { n: 2, title: "Activation" },
  { n: 3, title: "Attention" },
  { n: 4, title: "Self-talk & cues" },
  { n: 5, title: "Imagery" },
  { n: 6, title: "Falling, failure & RESET" },
  { n: 7, title: "Strategy & comp day" },
  { n: 8, title: "Simulation & Playbook" }
];

const CM = (() => {
  const KEY = "cm.v1";
  const blank = () => ({
    user: null, profile: {}, progress: {}, goals: {}, breakdown: {},
    sessions: [], pressure: [], queue: [], lastSync: null
  });

  let S;
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch (e) { S = blank(); }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const newId = p => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fmtDate = iso => { try { return new Date(iso + "T12:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return iso; } };
  const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split("."); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== "object") a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };

  /* ---------- user ---------- */
  function user() { return S.user; }
  function requireUser() {
    if (!S.user) { location.replace("login.html"); return null; }
    return S.user;
  }
  function devLogin(name) {
    S.user = { uid: "dev-" + Math.random().toString(36).slice(2, 10), name: name || "Dev athlete", email: "", dev: true, createdAt: new Date().toISOString() };
    if (!S.profile.name) S.profile.name = S.user.name;
    save();
  }
  function signOut() {
    S.user = null; save();
    location.href = "login.html";
  }
  function resetAll() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.href = "login.html";
  }
  function isYoung() { return S.profile.ageBand === "12-14"; }

  /* ---------- programme week ---------- */
  function currentWeek() {
    if (!S.profile.startDate) return 1;
    const days = Math.floor((new Date(today()) - new Date(S.profile.startDate)) / 86400000);
    return Math.min(CONFIG.PROGRAMME_WEEKS, Math.max(1, Math.floor(days / 7) + 1));
  }

  /* ---------- records + sync queue ---------- */
  // table: profile | goals | breakdown | sessions | pressure
  function record(table, id, data, week) {
    const rec = {
      table, id, uid: S.user ? S.user.uid : "", name: S.profile.name || (S.user && S.user.name) || "",
      week: week || currentWeek(), updatedAt: new Date().toISOString(), data
    };
    S.queue = S.queue.filter(q => q.id !== id);
    S.queue.push(rec);
    save();
    flush();
    return rec;
  }
  function saveProfile() { record("profile", S.user.uid + "-profile", S.profile, 1); }
  function saveGoals() { record("goals", S.user.uid + "-goals", S.goals); }
  function saveBreakdown() { record("breakdown", S.user.uid + "-breakdown-w1", S.breakdown, 1); }
  function addEntry(list, entry) {
    const arr = S[list];
    const i = arr.findIndex(e => e.id === entry.id);
    if (i >= 0) arr[i] = entry; else arr.push(entry);
    record(list, entry.id, entry, entry.week);
  }

  let flushing = false;
  async function flush() {
    renderSync();
    if (flushing || !CONFIG.SCRIPT_URL || !S.queue.length || !navigator.onLine) return;
    flushing = true;
    const batch = S.queue.slice(0, 25);
    try {
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ key: CONFIG.APP_KEY, records: batch })
      });
      const out = await res.json();
      if (out.ok) {
        const done = new Set(out.saved || []);
        // Only drop items that haven't been changed again since they were sent
        S.queue = S.queue.filter(q => !(done.has(q.id) && batch.some(b => b.id === q.id && b.updatedAt === q.updatedAt)));
        S.lastSync = new Date().toISOString();
        save();
      }
    } catch (e) { /* offline or script error: keep queue, try later */ }
    flushing = false;
    renderSync();
    if (S.queue.length && S.lastSync && Date.now() - new Date(S.lastSync) < 5000) setTimeout(flush, 500);
  }
  function renderSync() {
    const el = $("#sync"); if (!el) return;
    el.className = "sync";
    if (!CONFIG.SCRIPT_URL) { el.textContent = "Saved on this phone"; return; }
    if (S.queue.length) { el.classList.add("pending"); el.textContent = navigator.onLine ? "Syncing…" : `${S.queue.length} waiting to sync`; return; }
    el.classList.add("ok"); el.textContent = "Synced";
  }
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) flush(); });

  /* ---------- Week 1 task status ---------- */
  function goalsDone() {
    const g = S.goals;
    return !!(g.outcome && g.p1 && (isYoung() || (g.performance && g.p2)));
  }
  function weekTasks(week) {
    const sessions = S.sessions.filter(e => e.week === week).length;
    const pressure = S.pressure.filter(e => e.week === week).length;
    return [
      { n: 1, title: "Set up the app", sub: "Onboarding and your Competition Profile", href: "module1.html#onboarding", done: !!S.profile.onboarded },
      { n: 2, title: "Set your goals", sub: isYoung() ? "Your next comp and one process goal" : "Outcome, performance and 2 process goals", href: "module1.html#goals", done: goalsDone() },
      { n: 3, title: "Break down your comp video", sub: "Find where you could have stepped in", href: "module1.html#breakdown", done: !!S.breakdown.completedAt },
      { n: 4, title: "Assess every session", sub: "One minute after each training session", href: "session.html", done: sessions >= 3, count: `${Math.min(sessions, 3)}/3` },
      { n: 5, title: "One pressure climb per session", sub: "Log it through the chain", href: "pressure.html", done: pressure >= 3, count: `${Math.min(pressure, 3)}/3` }
    ];
  }

  /* ---------- form helpers ---------- */
  function chips(bind, options, value, multi) {
    const vals = multi ? (value || []) : [value];
    return `<div class="chips" data-bind="${bind}" data-multi="${multi ? 1 : 0}" role="group">` +
      options.map(o => `<button type="button" class="chip" aria-pressed="${vals.includes(o)}" data-val="${esc(o)}">${esc(o)}</button>`).join("") +
      `</div>`;
  }
  function scale(bind, value, from = 0, to = 10, lo = "", hi = "") {
    let h = `<div class="scale" data-bind="${bind}" style="grid-template-columns:repeat(${to - from + 1},1fr)" role="group">`;
    for (let i = from; i <= to; i++) h += `<button type="button" aria-pressed="${value === i}" data-val="${i}">${i}</button>`;
    h += `</div>`;
    if (lo || hi) h += `<div class="scale-ends"><span>${esc(lo)}</span><span>${esc(hi)}</span></div>`;
    return h;
  }
  function text(bind, value, { id, placeholder = "", area = false, type = "text" } = {}) {
    const a = `id="${id || "f-" + bind.replace(/\./g, "-")}" data-bind="${bind}" placeholder="${esc(placeholder)}"`;
    return area ? `<textarea ${a}>${esc(value)}</textarea>` : `<input type="${type}" ${a} value="${esc(value)}">`;
  }
  function checkbox(bind, value, label) {
    return `<label class="check"><input type="checkbox" data-bind="${bind}" ${value ? "checked" : ""}><span>${label}</span></label>`;
  }

  // Wires data-bind controls inside root to the draft object.
  // onChange(bind) is called after chip/scale clicks (which usually need a re-render).
  function bind(root, getDraft, onChange) {
    root.addEventListener("click", ev => {
      const b = ev.target.closest(".chips button, .scale button");
      if (!b || !root.contains(b)) return;
      const box = b.parentElement, key = box.dataset.bind, draft = getDraft();
      if (box.classList.contains("scale")) setPath(draft, key, +b.dataset.val);
      else if (box.dataset.multi === "1") {
        const arr = (getPath(draft, key) || []).slice(); const i = arr.indexOf(b.dataset.val);
        i >= 0 ? arr.splice(i, 1) : arr.push(b.dataset.val); setPath(draft, key, arr);
      } else setPath(draft, key, getPath(draft, key) === b.dataset.val ? "" : b.dataset.val);
      onChange && onChange(key);
    });
    root.addEventListener("input", ev => {
      const el = ev.target; if (!el.dataset || !el.dataset.bind || el.type === "checkbox") return;
      setPath(getDraft(), el.dataset.bind, el.value);
    });
    root.addEventListener("change", ev => {
      const el = ev.target; if (!el.dataset || !el.dataset.bind || el.type !== "checkbox") return;
      setPath(getDraft(), el.dataset.bind, el.checked);
      onChange && onChange(el.dataset.bind);
    });
  }

  // Step-by-step form. steps: [{render(draft) -> html, valid(draft) -> true | "message", link?}]
  function stepper({ root, steps, getDraft, onFinish, chainLinks, finishLabel = "Save" }) {
    let i = 0, err = "";
    const list = () => steps.filter(s => !s.when || s.when(getDraft()));
    function render() {
      const st = list(), s = st[i], last = i === st.length - 1;
      let chain = "";
      if (chainLinks && s.link != null) {
        chain = `<div class="chain" aria-hidden="true">` + chainLinks.map((l, k) =>
          (k ? `<div class="rope"></div>` : "") + `<div class="link ${k < s.link ? "done" : k === s.link ? "on" : ""}"><div class="hold"></div><span>${l}</span></div>`).join("") + `</div>`;
      } else {
        chain = `<div class="progress" aria-hidden="true">${st.map((_, k) => `<span class="${k < i ? "done" : k === i ? "on" : ""}"></span>`).join("")}</div>`;
      }
      root.innerHTML = `${chain}<div class="stack">${s.render(getDraft())}</div>
        ${err ? `<p class="err" role="alert">${esc(err)}</p>` : ""}
        <div class="nav">${i > 0 ? `<button type="button" class="btn ghost" data-step="back">Back</button>` : ""}
        <button type="button" class="btn primary" data-step="${last ? "finish" : "next"}">${last ? finishLabel : "Next"}</button></div>
        <p class="hint" style="text-align:center">Step ${i + 1} of ${st.length}</p>`;
    }
    root.addEventListener("click", ev => {
      const b = ev.target.closest("[data-step]"); if (!b) return;
      const st = list(), act = b.dataset.step;
      if (act === "back") { i = Math.max(0, i - 1); err = ""; render(); window.scrollTo(0, 0); return; }
      const ok = st[i].valid ? st[i].valid(getDraft()) : true;
      if (ok !== true) { err = ok; render(); return; }
      err = "";
      if (act === "next") { i++; render(); window.scrollTo(0, 0); }
      else onFinish();
    });
    bind(root, getDraft, () => { err = ""; render(); });
    render();
    return { render, reset() { i = 0; err = ""; render(); } };
  }

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }

  document.addEventListener("DOMContentLoaded", () => { renderSync(); flush(); });

  return {
    get state() { return S; }, save, $, esc, today, newId, fmtDate,
    user, requireUser, devLogin, signOut, resetAll, isYoung, currentWeek,
    saveProfile, saveGoals, saveBreakdown, addEntry, flush, weekTasks, goalsDone,
    chips, scale, text, checkbox, bind, stepper, toast
  };
})();

/* Shared option lists (used by the logs and module pages) */
const OPTS = {
  ageBand: ["12-14", "15-17", "18+"],
  disciplines: ["Bouldering", "Lead", "Speed"],
  sessionType: ["Bouldering", "Lead", "Both", "Comp / simulation", "Other training"],
  goalDone: ["Yes", "Partly", "No"],
  context: ["Bouldering", "Lead"],
  situation: ["Hard move or crux", "Someone watching", "Trying to flash", "Project attempt", "Fell on something I should do", "Ran out of time", "Compared myself to others", "Other"],
  emotion: ["Nervous", "Excited", "Frustrated", "Scared", "Flat", "Calm", "Confident", "Embarrassed"],
  body: ["Tense", "Fast breathing", "Over-gripping", "Shaky legs", "Heavy or tired", "Felt light and ready"],
  behaviour: ["Rushed", "Hesitated", "Skipped reading", "Backed off", "Committed", "Stayed calm", "Climbed well"],
  result: ["Topped / sent", "Got the zone", "Fell at the crux", "Fell early", "Didn't try it"],
  youngThought: ["Don't fall", "I can't do this", "Everyone's watching", "I've got this"],
  youngDid: ["Rushed", "Froze", "Tried my best", "Stayed calm", "Gave up"],
  links: ["Situation", "Thought", "Emotion", "Body", "Behaviour", "Result"],
  cpFeel: ["Excited", "Nervous", "Tense in my body", "Tired or flat", "Sick or no appetite", "Very motivated", "Calm"],
  cpThink: ["About the result or ranking", "About other climbers", "About falling", "About making mistakes", "About who's watching", "About climbing perfectly", "Not much — I feel clear"],
  cpDo: ["Go quiet", "Talk a lot", "Rush my warm-up", "Keep checking the time or scores", "Watch other climbers a lot", "Avoid looking at the wall", "Stick to a routine"]
};
