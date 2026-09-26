const input = document.querySelector("#documentInput");
const fileName = document.querySelector("#fileName");
const dropTitle = document.querySelector("#dropTitle");
const analyzeButton = document.querySelector("#analyzeButton");
const demoPatients = document.querySelector("#demoPatients");
const dropzone = document.querySelector("#dropzone");
const clearLogButton = document.querySelector("#clearLog");
const dashboardButton = document.querySelector("#dashboardButton");
const loginButton = document.querySelector("#loginButton");
const loginForm = document.querySelector("#loginForm");
const authError = document.querySelector("#authError");
const page = document.body;

let analysisRunning = false;
let authMode = "login";

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function humanStatus(value) {
  return String(value || "-").replaceAll("_", " ").toUpperCase();
}

/* ---------- auth ---------- */
function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem("aria-auth-user") || "null");
  } catch (_error) {
    return null;
  }
}

function applyAuthState() {
  const user = getAuthUser();
  if (user?.name) {
    loginButton.textContent = `${user.name.split(" ")[0]} · Logout`;
  } else {
    loginButton.innerHTML = "Login <span>↗</span>";
  }
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelector("#tabLogin")?.classList.toggle("active", mode === "login");
  document.querySelector("#tabSignup")?.classList.toggle("active", mode === "signup");
  const nameField = document.querySelector("#nameField");
  if (nameField) nameField.hidden = mode !== "signup";
  const title = document.querySelector("#authTitle");
  if (title) title.textContent = mode === "signup" ? "Create your ARIA account." : "Sign in to ARIA.";
  const hint = document.querySelector("#authHint");
  if (hint) hint.hidden = mode !== "signup";
  const submit = document.querySelector("#loginSubmit");
  if (submit) submit.innerHTML = mode === "signup" ? "Create account <span>→</span>" : "Login <span>→</span>";
  const error = document.querySelector("#authError");
  if (error) error.textContent = "";
}

function saveAuth(data) {
  localStorage.setItem("aria-auth-token", data.token);
  localStorage.setItem("aria-auth-user", JSON.stringify(data.user));
  applyAuthState();
  loadRecentReports(); /* the patient list is now scoped to this doctor */
}

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (_error) {}
  localStorage.removeItem("aria-auth-token");
  localStorage.removeItem("aria-auth-user");
  applyAuthState();
  loadRecentReports();
  showHome();
}

function goToStation(index) {
  if (window.ariaStation) window.ariaStation.goTo(index);
}

function currentStation() {
  return window.ariaStation ? window.ariaStation.current : 0;
}

function revealDashboard() {
  showDashboard();
  const dashboard = document.querySelector(".dashboard-panel");
  dashboard.classList.remove("revealing");
  requestAnimationFrame(() => dashboard.classList.add("revealing"));
  /* lift the dashboard to the center of the screen; gates lock until it is closed */
  window.ariaStation?.popDashboardCentered?.();
}

function showDashboard() {
  window.ariaStation?.unlockDashboard?.();
  goToStation(1);
  window.ariaStation?.popCard?.(1);   /* the dashboard opens centered */
  dashboardButton.textContent = "Home ↙";
  loginButton.innerHTML = "Login <span>↗</span>";
  window.history.replaceState(null, "", "#dashboard");
}

function showHome() {
  goToStation(0);
  dashboardButton.innerHTML = "Dashboard <span>↗</span>";
  loginButton.innerHTML = "Login <span>↗</span>";
  window.history.replaceState(null, "", window.location.pathname);
}

function showLogin() {
  goToStation(6);
  window.ariaStation?.popCard?.(6);   /* the sign-in card opens centered */
  dashboardButton.innerHTML = "Dashboard <span>↗</span>";
  loginButton.textContent = "Home ↙";
  window.history.replaceState(null, "", "#login");
}

function setBusy(state) {
  analysisRunning = state;
  page.classList.toggle("is-busy", state);
  analyzeButton.disabled = state;
  analyzeButton.textContent = state ? "ARIA is reading…" : "Analyze with ARIA →";
}

function showFile(file) {
  const intakePanel = document.querySelector(".intake-panel");
  if (!file) {
    intakePanel?.classList.remove("has-report-loaded");
    dropzone.classList.remove("report-loaded");
    dropTitle.textContent = "Drop a discharge document here";
    fileName.textContent = "PDF, scanned PDF, image, TXT or JSON";
    return;
  }
  intakePanel?.classList.add("has-report-loaded");
  dropzone.classList.add("report-loaded");
  dropTitle.textContent = `${file.name} loaded`;
  fileName.textContent = "Tap to choose a different document";
}

input.addEventListener("change", () => showFile(input.files[0]));

["dragenter", "dragover"].forEach(type => {
  dropzone.addEventListener(type, event => {
    event.preventDefault();
    if (!analysisRunning) dropzone.classList.add("dragging");
  });
});
["dragleave", "drop"].forEach(type => {
  dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
  });
});
dropzone.addEventListener("drop", event => {
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  } catch (_error) {}
  showFile(file);
});

document.querySelector("#scrollIntake").addEventListener("click", () => {
  showHome();
  goToStation(0);
  window.ariaStation?.popCard?.(0);   /* the upload card opens centered */
});
document.querySelector("#heroAnalyze").addEventListener("click", () => {
  showHome();
  goToStation(0);
  window.ariaStation?.popCard?.(0);   /* the upload card opens centered */
  dropzone.classList.add("dragging");
  setTimeout(() => dropzone.classList.remove("dragging"), 900);
});
document.querySelector("#seeSystem").addEventListener("click", () => {
  goToStation(3);
});
dashboardButton.addEventListener("click", () => {
  if (currentStation() === 1) {
    showHome();
    return;
  }
  showDashboard();
});
loginButton.addEventListener("click", () => {
  if (getAuthUser()) {
    logout();
    return;
  }
  if (currentStation() === 6) {
    showHome();
    return;
  }
  showLogin();
});

document.querySelector("#tabLogin")?.addEventListener("click", () => setAuthMode("login"));
document.querySelector("#tabSignup")?.addEventListener("click", () => setAuthMode("signup"));

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  authError.textContent = "";

  const name = document.querySelector("#signupName")?.value.trim();
  const email = document.querySelector("#loginEmail").value.trim();
  const password = document.querySelector("#loginPassword").value;
  if (authMode === "signup" && (!name || name.length < 2)) {
    authError.textContent = "Enter your full name.";
    return;
  }
  if (!email || !email.includes("@") || !password) {
    authError.textContent = "Enter your email and password.";
    return;
  }

  setLoginBusy(true);
  try {
    const endpoint = authMode === "signup" ? "/api/auth/register" : "/api/auth/login";
    const body = authMode === "signup" ? { name, email, password } : { email, password };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Authentication failed.");

    saveAuth(data);
    showDashboard();
  } catch (error) {
    authError.textContent = error.message;
  } finally {
    setLoginBusy(false);
  }
});

analyzeButton.addEventListener("click", async () => {
  if (!input.files[0]) {
    fileName.textContent = "Choose a clinical document first";
    document.querySelector("#dropzone")?.classList.add("dragging");
    setTimeout(() => document.querySelector("#dropzone")?.classList.remove("dragging"), 700);
    return;
  }
  const formData = new FormData();
  formData.append("document", input.files[0]);
  await analyze(formData);
});

async function analyze(formData) {
  setBusy(true);
  window.ariaScene?.reportLoaded?.();
  setText("patientName", "Reading clinical signal…");
  setText("patientReportName", "Reading clinical signal…");
  setText("dashboardSub", "Tesseract is extracting, cleaning, and interpreting the document.");
  setText("ocrMode", "TESSERACT · PROCESSING");
  setText("extractionQuality", "SCANNING");
  renderTimeline([
    { at: new Date().toISOString(), label: "Document received by ARIA" },
    { at: new Date().toISOString(), label: "OCR pipeline initialized" }
  ]);
  revealDashboard();

  try {
    const response = await fetch("/api/reports/analyze", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Analysis failed");
    renderReport(data);
  } catch (error) {
    setText("dashboardSub", error.message);
    setText("decisionHeadline", "Analysis could not complete.");
    setText("decisionText", "Check the document format and server logs, then try again.");
    renderTimeline([{ at: new Date().toISOString(), label: error.message }]);
  } finally {
    setBusy(false);
  }
}

function renderReport(data) {
  const patient = data.patient || {};
  const risk = data.risk || {};
  const extraction = data.source?.extraction || {};
  const confidence = Number.isFinite(Number(extraction.confidence)) ? Number(extraction.confidence) : 0;
  const level = String(risk.level || "READY").toUpperCase();

  setText("patientName", patient.name || "Unknown Patient");
  setText("patientReportName", patient.name || "Unknown Patient");
  setText("patientAvatar", (patient.name || "A").trim().charAt(0).toUpperCase());
  setText("dashboardSub", `${patient.diagnosis || "Clinical story extracted"} · risk ${level}`);
  setText("patientAge", patient.age ? `${patient.age} yrs` : "—");
  setText("diagnosis", patient.diagnosis || "—");
  setText("patientDoctor", patient.doctor || "—");
  setText("phone", data.routedContact || "—");
  setText("dischargeDate", patient.dischargeDate || "—");
  setText("riskScore", `${risk.score || 0}/100`);
  setText("ocrConfidence", `${confidence}%`);
  setText("smsStatus", humanStatus(data.sms?.status));
  setText("callStatus", humanStatus(data.call?.status));
  setText("smsMatrix", humanStatus(data.sms?.status));
  setText("callMatrix", humanStatus(data.call?.status));
  setText("familyMatrix", level === "HIGH" ? "ESCALATE" : "MONITOR");
  setText("doctorMatrix", level === "LOW" ? "ROUTINE" : "NOTIFY");
  setText("ocrMode", `${humanStatus(extraction.mode)} · ${extraction.processedPages || extraction.pages || 1}/${extraction.pages || 1} PAGES`);
  setText("extractedText", data.extractedText || "No text extracted.");
  setText("extractionQuality", `${confidence}% CONFIDENCE`);
  if (window.ariaScene) window.ariaScene.setRisk(risk.score || 0, level);
  setText("decisionHeadline", risk.recommendation || "Clinical routing ready.");
  setText("decisionText", `${level} priority · ${risk.requiresCall ? "voice call + SMS" : "SMS monitoring"}`);

  const badge = document.querySelector("#riskBadge");
  badge.textContent = "";
  badge.className = `risk-badge ${(level || "idle").toLowerCase()}`;
  badge.innerHTML = `<span></span>${level}`;

  document.querySelector("#scoreBar").style.width = `${Math.min(Number(risk.score) || 0, 100)}%`;
  document.querySelector("#ocrBar").style.width = `${Math.min(confidence, 100)}%`;

  const ring = document.querySelector("#decisionRing");
  ring.className = `decision-ring ${level.toLowerCase()}`;

  renderList("riskFactors", risk.factors || []);
  renderOrdered("carePlan", risk.carePlan || []);
  renderMedicines(patient.medicines || []);
  renderTimeline(data.timeline || []);

  hasAnalyzedOnce = true;
  try { sessionStorage.setItem(HAS_REPORT_KEY, "1"); } catch (_error) {}
  updateAddAnother();

  /* monitoring calendar state (showcase) — opened by every upload */
  captureMonitoring(data, patient, level);
  /* patient SMS + voice dispatch fires only now: the AI decision is on screen */
  releasePatientDispatch(data);

  saveHistoryEntry(patient, risk, data.ids?.report || null, data.file?.originalName || null);
  revealDashboard();
  loadRecentReports();
}

/* ---------- monitoring calendar (showcase) ---------- */
const CAL_KEY = "aria-monitoring";
let monitorState = null;

function readMonitorState() {
  if (monitorState) return monitorState;
  try {
    const parsed = JSON.parse(localStorage.getItem(CAL_KEY) || "null");
    monitorState = parsed && parsed.days ? parsed : null;
  } catch (_error) {
    monitorState = null;
  }
  return monitorState;
}

function saveMonitorState() {
  try {
    if (monitorState) localStorage.setItem(CAL_KEY, JSON.stringify(monitorState));
    else localStorage.removeItem(CAL_KEY);
  } catch (_error) {}
}

function captureMonitoring(data, patient, level) {
  const monitoring = data.monitoring;
  if (!monitoring || !monitoring.days) return;
  monitorState = {
    patient: patient?.name || "Unknown Patient",
    level,
    days: monitoring.days,
    startedAt: monitoring.startedAt || new Date().toISOString(),
    schedule: monitoring.schedule || [],
    requiresCall: Boolean(data.risk?.requiresCall),
    dispatchedAt: data.dispatchToken ? null : (data.dispatch?.dispatchedAt || null),
    sms: data.sms?.status || null,
    call: data.call?.status || null
  };
  saveMonitorState();
  renderCalendarSurfaces();
}

/*
  The server HOLDS the patient's SMS + voice call when a report is uploaded.
  The AI decision is on screen now, so the follow-up is released — well
  within 10 seconds of the decision. One live dispatch per uploaded report;
  every later calendar day is showcase-only.
*/
function releasePatientDispatch(data) {
  const token = data.dispatchToken ||
    (data.dispatch && data.dispatch.status === "pending" ? (data.ids?.report || data._id) : null);
  if (!token) return;

  const timeline = Array.isArray(data.timeline) ? data.timeline.slice() : [];
  const applyDispatch = result => {
    if (result.sms) {
      setText("smsStatus", humanStatus(result.sms.status));
      setText("smsMatrix", humanStatus(result.sms.status));
    }
    if (result.call) {
      setText("callStatus", humanStatus(result.call.status));
      setText("callMatrix", humanStatus(result.call.status));
    }
    if (monitorState) {
      monitorState.dispatchedAt = result.dispatchedAt || new Date().toISOString();
      if (result.sms?.status) monitorState.sms = result.sms.status;
      if (result.call?.status) monitorState.call = result.call.status;
      saveMonitorState();
      renderCalendarSurfaces();
    }
    if (Array.isArray(result.timeline)) {
      renderTimeline(timeline.concat(result.timeline));
    }
  };

  const releaseIn = 1200; /* let the decision render first; still far inside the 10s window */
  setTimeout(async () => {
    try {
      const response = await fetch(`/api/reports/dispatch/${token}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Dispatch failed");
      applyDispatch(result);
    } catch (error) {
      renderTimeline(timeline.concat([{
        at: new Date().toISOString(),
        label: `Patient follow-up dispatch failed: ${error.message}`,
        status: "danger"
      }]));
    }
  }, releaseIn);
}

/* ---------- calendar UI: side card, mini grid, full popup ---------- */
const calModal = document.querySelector("#calendarModal");
let calView = null; /* {year, month} currently shown in the popup */

function monitorDayDate(state, day) {
  const start = new Date(state.startedAt);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + (day - 1));
  return start;
}

function monitorEndsAt(state) {
  return monitorDayDate(state, state.days);
}

function dayStatus(state, day) {
  const date = monitorDayDate(state, day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (day === 1 && state.dispatchedAt) return "done";
  if (date < today) return "crossed"; /* past showcase day */
  if (date.getTime() === today.getTime()) return "today";
  return "scheduled";
}

function renderCalendarSurfaces() {
  const state = readMonitorState();
  const stateChip = document.querySelector("#calSideState");
  const summary = document.querySelector("#calSideSummary");
  const mini = document.querySelector("#calMini");

  if (!state) {
    if (stateChip) stateChip.textContent = "IDLE";
    if (summary) summary.textContent = "No monitoring window open — analyze a document to begin.";
    if (mini) mini.innerHTML = "";
    return;
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = monitorDayDate(state, 1);
  const end = monitorEndsAt(state);
  const dayNum = today >= start && today <= end ? Math.round((today - start) / 86400000) + 1 : null;

  if (stateChip) stateChip.textContent = dayNum ? `DAY ${dayNum}/${state.days}` : "WINDOW ENDED";
  if (summary) {
    const next = dayNum && dayNum < state.days ? `Next check-in ${monitorDayDate(state, dayNum + 1).toLocaleDateString()}` : "Window complete";
    summary.textContent = `Monitoring ${state.patient} · ${state.level} risk · ${state.days}-day window · ${next} (daily calls/SMS are a showcase — only the first was live).`;
  }
  if (mini) renderMiniCalendar(mini, state);
}

function renderMiniCalendar(node, state) {
  const start = monitorDayDate(state, 1);
  const end = monitorEndsAt(state);
  const frag = document.createDocumentFragment();
  for (let day = 1; day <= state.days; day++) {
    const cell = document.createElement("span");
    const status = dayStatus(state, day);
    const entry = state.schedule[day - 1] || {};
    cell.className = `cal-mini-day ${status} ${entry.channel === "call+sms" ? "has-call" : "sms-only"}`;
    cell.textContent = day;
    cell.title = `Day ${day} · ${monitorDayDate(state, day).toLocaleDateString()} · ${entry.channel || "sms"}`;
    frag.appendChild(cell);
  }
  node.innerHTML = "";
  node.appendChild(frag);
}

function openCalendarModal() {
  const state = readMonitorState();
  if (!state) {
    calModal.hidden = false;
    requestAnimationFrame(() => calModal.classList.add("open"));
    setText("calPatient", "No active monitoring");
    setText("calSub", "Analyze a discharge document to open a monitoring window for a patient.");
    setText("calMonthLabel", new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }));
    document.querySelector("#calStats").innerHTML = "";
    document.querySelector("#calGrid").innerHTML = "<p class='cal-empty'>The calendar lights up after the first analyzed report.</p>";
    setText("calNote", "");
    document.body.classList.add("modal-open");
    return;
  }
  const today = new Date();
  calView = { year: today.getFullYear(), month: today.getMonth() };
  setText("calPatient", state.patient);
  setText("calSub", `${state.level} risk · ${state.days}-day monitoring window opened ${new Date(state.startedAt).toLocaleDateString()}`);
  renderCalendarGrid();
  calModal.hidden = false;
  requestAnimationFrame(() => calModal.classList.add("open"));
  document.body.classList.add("modal-open");
}

function closeCalendarModal() {
  calModal.classList.remove("open");
  setTimeout(() => { calModal.hidden = true; }, 280);
  document.body.classList.remove("modal-open");
}

function renderCalendarGrid() {
  const state = readMonitorState();
  if (!state || !calView) return;
  const { year, month } = calView;
  setText("calMonthLabel", new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }));

  const start = monitorDayDate(state, 1);
  const end = monitorEndsAt(state);
  const firstCell = new Date(year, month, 1);
  const lead = firstCell.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  /* stats over the whole window */
  const calls = state.schedule.filter(e => e.channel === "call+sms").length;
  const sms = state.schedule.length - calls;
  const family = state.schedule.filter(e => e.family).length;
  const doctor = state.schedule.filter(e => e.doctor).length;
  document.querySelector("#calStats").innerHTML =
    `<div><b>${state.days}</b><span>DAYS</span></div>
     <div><b>${calls}</b><span>CALLS</span></div>
     <div><b>${sms}</b><span>SMS</span></div>
     <div><b>${family}</b><span>FAMILY</span></div>
     <div><b>${doctor}</b><span>DOCTOR</span></div>`;

  const grid = document.querySelector("#calGrid");
  grid.innerHTML = "";
  for (let i = 0; i < lead; i++) grid.appendChild(elWithClass("span", "cal-cell blank"));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const inWindow = date >= start && date <= end;
    const cell = elWithClass("div", "cal-cell");
    cell.style.setProperty("--i", d - 1);
    const num = elWithClass("span", "cal-num");
    num.textContent = d;
    cell.appendChild(num);

    if (inWindow) {
      const day = Math.round((date - start) / 86400000) + 1;
      const entry = state.schedule[day - 1] || {};
      const status = dayStatus(state, day);
      cell.classList.add("in-window", status, entry.channel === "call+sms" ? "has-call" : "sms-only");
      const mark = elWithClass("i", "cal-mark");
      mark.textContent = entry.channel === "call+sms" ? "☎" : "✉";
      cell.appendChild(mark);
      if (day === 1) {
        const live = elWithClass("em", "cal-flag live");
        live.textContent = state.dispatchedAt ? "LIVE ✓" : "LIVE";
        cell.appendChild(live);
      }
      if (entry.family || entry.doctor) {
        const badges = elWithClass("em", "cal-badges");
        badges.textContent = `${entry.family ? "F" : ""}${entry.doctor ? "D" : ""}`;
        cell.appendChild(badges);
      }
      /* hover date card — what ARIA does on this exact day */
      const statusText =
        day === 1
          ? (state.dispatchedAt ? `Live dispatch completed at ${new Date(state.dispatchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Live dispatch — fires once, right after the AI decision")
          : status === "today" ? "Today's automated check-in (showcase)"
          : status === "scheduled" ? `Automated check-in scheduled ${entry.time || "09:00"} (showcase — not sent)`
          : "Crossed off — check-in day passed";
      const tip = elWithClass("div", "cal-tip");
      const tipDate = document.createElement("b");
      tipDate.textContent = `Day ${day} · ${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
      const tipChannel = document.createElement("span");
      tipChannel.textContent = entry.channel === "call+sms" ? "Voice call + SMS to the patient" : "SMS check-in to the patient";
      const tipStatus = document.createElement("span");
      tipStatus.textContent = statusText;
      tip.append(tipDate, tipChannel, tipStatus);
      if (entry.family || entry.doctor) {
        const tipEsc = document.createElement("span");
        tipEsc.textContent = `Also: ${entry.family ? "family notified" : ""}${entry.family && entry.doctor ? " · " : ""}${entry.doctor ? "doctor review" : ""}`;
        tip.appendChild(tipEsc);
      }
      cell.appendChild(tip);
    } else {
      /* plain days still get a light hover card */
      const tip = elWithClass("div", "cal-tip");
      const tipDate = document.createElement("b");
      tipDate.textContent = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      const tipStatus = document.createElement("span");
      tipStatus.textContent = "Outside the monitoring window";
      tip.append(tipDate, tipStatus);
      cell.appendChild(tip);
    }
    if (date.getTime() === today.getTime()) cell.classList.add("is-today");
    grid.appendChild(cell);
  }

  setText("calNote", "Day 1 is the only live dispatch — it fires once, right after the AI decision. Every further day is an automated check-in plan for showcase: nothing is actually sent.");
}

function elWithClass(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

document.querySelector("#openCalendar")?.addEventListener("click", openCalendarModal);
document.querySelector("#calSideOpen")?.addEventListener("click", openCalendarModal);
document.querySelector("#calClose")?.addEventListener("click", closeCalendarModal);
document.querySelector("#calBackdrop")?.addEventListener("click", closeCalendarModal);
document.querySelector("#calPrev")?.addEventListener("click", () => {
  if (!calView) return;
  calView.month--;
  if (calView.month < 0) { calView.month = 11; calView.year--; }
  renderCalendarGrid();
});
document.querySelector("#calNext")?.addEventListener("click", () => {
  if (!calView) return;
  calView.month++;
  if (calView.month > 11) { calView.month = 0; calView.year++; }
  renderCalendarGrid();
});
document.querySelector("#calToday")?.addEventListener("click", () => {
  const now = new Date();
  calView = { year: now.getFullYear(), month: now.getMonth() };
  renderCalendarGrid();
});
addEventListener("keydown", e => {
  if (e.key === "Escape" && calModal && !calModal.hidden) closeCalendarModal();
});

/* ---------- intro: ARIA logo video on first load + every 2D open ---------- */
const introScreen = document.querySelector("#intro");
const introVideo = document.querySelector("#ariaLogoVideo");
let introHideTimer = null;

function hideIntro() {
  clearTimeout(introHideTimer);
  introScreen?.classList.add("is-done");
  try { introVideo?.pause(); } catch (_error) {}
}

function playIntroVideo() {
  if (!introScreen) return;
  introScreen.classList.remove("is-done");
  introScreen.setAttribute("aria-hidden", "false");
  if (introVideo) {
    /* a hidden video-only element gets its data dropped by the browser to save
       power — force a reload, then start as soon as frames are available */
    const startWhenReady = () => {
      try {
        const played = introVideo.play();
        if (played?.catch) played.catch(() => {/* fallback timer still ends the splash */});
      } catch (_error) {}
    };
    try { introVideo.currentTime = 0; } catch (_error) {}
    introVideo.addEventListener("canplay", startWhenReady, { once: true });
    try { introVideo.load(); } catch (_error) {}
    startWhenReady();
    introVideo.addEventListener("ended", hideIntro, { once: true });
    introVideo.addEventListener("error", hideIntro, { once: true });
  }
  /* fallback if the video cannot play — the splash ends on its own */
  clearTimeout(introHideTimer);
  introHideTimer = setTimeout(hideIntro, 11500);
}

function startIntro() {
  /* no logo video on first load — the splash (with video) plays only when 2D opens */
  introScreen?.classList.add("is-done");
}

introScreen?.addEventListener("click", hideIntro);
document.querySelector("#introSkip")?.addEventListener("click", e => { e.stopPropagation(); hideIntro(); });
/* 3D → 2D toggle replays the logo video (inline scene code calls this) */
window.ariaIntro = { replay: playIntroVideo };

/* "Add another report" — appears only after the first successful analysis */
const HAS_REPORT_KEY = "aria-has-reports";
let hasAnalyzedOnce = false;

function updateAddAnother() {
  const button = document.querySelector("#addAnotherReport");
  if (!button) return;
  try { hasAnalyzedOnce = hasAnalyzedOnce || sessionStorage.getItem(HAS_REPORT_KEY) === "1"; } catch (_error) {}
  button.hidden = !hasAnalyzedOnce;
}

document.querySelector("#addAnotherReport")?.addEventListener("click", () => {
  try { input.value = ""; } catch (_error) {}
  showFile(null);
  dropTitle.textContent = "Drop the next document here";
  fileName.textContent = "PDF, scanned PDF, image, TXT or JSON";
  dropzone.classList.add("dragging");
  setTimeout(() => dropzone.classList.remove("dragging"), 900);
  dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
});

function renderList(id, values) {
  const node = document.querySelector(`#${id}`);
  node.innerHTML = "";
  (values.length ? values : ["No major red flags detected"]).forEach(value => {
    const item = document.createElement("li");
    item.textContent = value;
    node.appendChild(item);
  });
}

function renderOrdered(id, values) {
  const node = document.querySelector(`#${id}`);
  node.innerHTML = "";
  (values.length ? values : ["Routine monitoring"]).forEach(value => {
    const item = document.createElement("li");
    item.textContent = value;
    node.appendChild(item);
  });
}

function renderMedicines(values) {
  const node = document.querySelector("#medicines");
  node.innerHTML = "";
  (values.length ? values : ["No medicines extracted"]).forEach(value => {
    const item = document.createElement("span");
    item.textContent = value;
    node.appendChild(item);
  });
}

function renderTimeline(values) {
  const node = document.querySelector("#timeline");
  node.innerHTML = "";
  (values.length ? values : [{ at: new Date().toISOString(), label: "Ready for clinical document analysis" }]).forEach(entry => {
    const item = document.createElement("li");
    const time = entry.at ? new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "NOW";
    item.textContent = `${time} — ${entry.label}`;
    node.appendChild(item);
  });
}

clearLogButton.addEventListener("click", async () => {
  if (!window.confirm("Clear all activity history?")) return;

  clearLogButton.disabled = true;
  clearLogButton.textContent = "Clearing…";
  try {
    const response = await fetch("/api/logs", { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.cleared) throw new Error(data.error || "History could not be cleared");
    renderTimeline([]);
    setText("dashboardSub", "Activity history cleared. Ready for the next patient signal.");
  } catch (error) {
    setText("dashboardSub", error.message);
  } finally {
    clearLogButton.disabled = false;
    clearLogButton.textContent = "Clear history";
  }
});

async function loadDemoPatients() {
  try {
    const response = await fetch("/api/demo-patients");
    const patients = await response.json();
    demoPatients.innerHTML = "";
    patients.forEach(patient => {
      const button = document.createElement("button");
      button.type = "button";
      const level = patient.demoRisk || inferDemoRisk(patient.name);
      button.innerHTML = `<span><strong>${patient.name}</strong><span>${patient.diagnosis}</span></span><b class="demo-risk ${level.toLowerCase()}">${level}</b>`;
      button.addEventListener("click", async () => {
        const blob = new Blob([patient.text], { type: "text/plain" });
        const formData = new FormData();
        formData.append("document", blob, `${patient.name.replaceAll(" ", "_")}.txt`);
        await analyze(formData);
      });
      demoPatients.appendChild(button);
    });
  } catch (_error) {
    demoPatients.innerHTML = "<span>Demo patient service unavailable.</span>";
  }
}

function inferDemoRisk(name) {
  const map = { "Asha Devi":"HIGH", "Ravi Kumar":"MEDIUM", "Meena Joseph":"HIGH", "Vikram Singh":"LOW", "Surya":"HIGH", "Vikas":"HIGH" };
  return map[name] || "MEDIUM";
}

function setLoginBusy(state) {
  const button = document.querySelector("#loginSubmit");
  button.disabled = state;
  button.innerHTML = state
    ? "Checking access…"
    : (authMode === "signup" ? "Create account <span>→</span>" : "Login <span>→</span>");
}

/* ---------- recent signals: server reports + on-device history (saved on every upload) ---------- */
const HISTORY_KEY = "aria-patient-history";

function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveHistoryEntry(patient, risk, reportId, fileName) {
  const entry = {
    id: reportId || null,
    name: patient?.name || "Unknown Patient",
    diagnosis: patient?.diagnosis || "—",
    level: String(risk?.level || "—").toUpperCase(),
    file: fileName || null,
    at: new Date().toISOString()
  };
  if (entry.name === "Unknown Patient" && entry.diagnosis === "—") return;
  const history = readHistory().filter(item => !item.id || item.id !== entry.id);
  history.unshift(entry);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
  } catch (_error) {}
}

async function loadRecentReports() {
  const list = document.querySelector("#recentReports");
  if (!list) return;

  let serverReports = [];
  let dbConnected = false;
  let scopedToUser = false;
  try {
    const response = await fetch("/api/reports");
    const data = await response.json();
    dbConnected = data.database === "connected";
    scopedToUser = Boolean(data.scopedToUser);
    serverReports = data.reports || [];
  } catch (_error) {}

  /*
    A signed-in doctor sees ONLY their own patients (server-filtered).
    Anonymous visitors additionally see the on-device history.
  */
  const serverIds = new Set(serverReports.map(report => String(report._id)));
  const localItems = !getAuthUser() && !scopedToUser
    ? readHistory()
      .filter(item => !item.id || !serverIds.has(String(item.id)))
      .map(item => ({ id: item.id, name: item.name, diagnosis: item.diagnosis, level: item.level, at: item.at }))
    : [];
  const serverItems = serverReports.map(report => ({
    id: String(report._id),
    name: report.patient?.name || "Unknown Patient",
    diagnosis: report.patient?.diagnosis || "—",
    level: String(report.risk?.level || "—").toUpperCase(),
    at: report.createdAt
  }));

  const merged = [...serverItems, ...localItems]
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, 12);

  setText("recentDb", dbConnected ? (getAuthUser() ? "MY PATIENTS" : "SAVED REPORTS") : "DEVICE HISTORY");
  list.innerHTML = "";
  if (!merged.length) {
    const li = document.createElement("li");
    li.textContent = getAuthUser()
      ? "No patients yet — reports you analyze will appear here."
      : "No saved reports yet — analyze a document and it will appear here.";
    list.appendChild(li);
    return;
  }
  merged.forEach(item => {
    const level = item.level || "—";
    const element = document.createElement("li");
    element.innerHTML = `<b></b><span></span><em class="rl ${level.toLowerCase()}"></em>`;
    element.querySelector("b").textContent = item.name;
    element.querySelector("span").textContent = item.diagnosis;
    element.querySelector("em").textContent = level;
    if (item.id) element.addEventListener("click", () => openReport(item.id));
    list.appendChild(element);
  });
}

async function openReport(id) {
  try {
    const response = await fetch(`/api/reports/${id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Report could not be opened.");
    renderReport(data);
    showDashboard();
  } catch (error) {
    setText("dashboardSub", error.message);
  }
}

document.querySelector("#printReport")?.addEventListener("click", () => window.print());

if (window.location.hash === "#dashboard") showDashboard();
if (window.location.hash === "#login") showLogin();
applyAuthState();
loadRecentReports();
startIntro();
loadDemoPatients();
updateAddAnother();
renderCalendarSurfaces();
