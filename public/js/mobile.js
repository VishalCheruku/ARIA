/* ============================================================================
   ARIA AI — MOBILE LAYER (device detection + 2D fallback UI)
   Loads last (after the inline scene script and app.js). Desktop behavior is
   untouched: everything below either no-ops or is gated behind body.mobile.

   What it does
   1.  Detects phones/tablets (UA + touch + screen heuristics) → body.mobile
   2.  Forces the 2D flat home on mobile devices (3D stage stays display:none
       via CSS — the WebGL renderer itself never boots on phones, see index.html)
   3.  Bottom navigation (5 sections) + step indicator (1/5 …) + hamburger drawer
   4.  Swipe left/right between sections; swipe on the calendar changes month
   5.  Dashboard accordion on phones; long-press-to-copy on patient fields
   6.  Camera/photo-library upload triggers (the inputs live in index.html)
   7.  Honors prefers-color-scheme on first visit; saved choice still wins
   ============================================================================ */
(function () {
  "use strict";

  /* ---------- 1 · device detection ---------- */
  var ua = navigator.userAgent || "";
  var uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  var iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(ua); /* iPadOS 13+ masquerades as macOS */
  var tinyScreen = Math.min(window.screen.width, window.screen.height) <= 480;
  var isMobileDevice = uaMobile || iPadOS || tinyScreen;

  /* narrow window (resized desktop or small foldable) also gets the 2D UI */
  var narrowViewport = window.matchMedia("(max-width: 767px)").matches;
  var mobile = isMobileDevice || narrowViewport;

  var body = document.body;

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  /* ---------- toast helper (also used for copy feedback / errors) ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg, kind) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "m-toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = "m-toast" + (kind ? " " + kind : "");
    /* retrigger the transition even when the same class is already set */
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  /* ---------- 2 · force the 2D flat home on mobile ---------- */
  /* Skip the 3.6MB logo video on phones: the splash falls back to the pure-CSS
     ECG and closes after a beat. Overriding replay() before the 2D switch. */
  if (isMobileDevice) {
    var introScreen = $("#intro");
    var introVideo = $("#ariaLogoVideo");
    if (introVideo) { introVideo.preload = "none"; }
    if (window.ariaIntro) {
      window.ariaIntro.replay = function () {
        if (!introScreen) return;
        introScreen.classList.remove("is-done");
        setTimeout(function () { introScreen.classList.add("is-done"); }, 1600);
      };
    }
    var bgm = $("#bgm");
    if (bgm) bgm.preload = "none";
  }

  function force2D() {
    /* The inline scene script owns mode switching; its toggle button is the
       public switch (keeps localStorage, intro replay and panel moves intact). */
    if (!body.classList.contains("mode-2d")) {
      var dim = $("#dimensionToggle");
      if (dim) dim.click();
    }
  }

  if (mobile) {
    body.classList.add("mobile");
    /* wait one tick so the inline boot (theme, saved mode, goTo(0)) finished */
    setTimeout(force2D, 0);
    /* following orientation/resize into desktop widths keeps the phone UI; the
       user can still reach "City version (3D)" from the drawer on tablets */
  }

  /* ---------- 3 · bottom navigation + step indicator ---------- */
  var SECTIONS = [
    { label: "Intake",    target: "flatIntakeSlot", icon: '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h4"/></svg>' },
    { label: "Report",    target: "flatGrow",       icon: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>' },
    { label: "Calendar",  target: "flatCalSlot",    icon: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>' },
    { label: "Loop",      target: "flatLoopSlot",   icon: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v4h-4"/></svg>' },
    { label: "Account",   target: null,             icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>' }
  ];
  var STEP_NAMES = ["INTAKE", "REPORT", "CALENDAR", "LOOP", "ACCESS"];
  var nav = $("#mobileBottomNav");
  var stepChip = $("#mobileStep");
  var currentStep = 0;

  function setStep(i) {
    currentStep = i;
    if (nav) $all(".bn-item").forEach(function (b, k) { b.classList.toggle("active", k === i); });
    if (stepChip) stepChip.textContent = (i + 1) + "/5 · " + STEP_NAMES[i];
  }

  function gotoSection(i) {
    if (!window.ariaStation) return;
    if (i === 4) {
      /* Account: signed-in doctors get a logout sheet, everyone else gets the
         secure-access card (the same pop the desktop login button uses) */
      var user = null;
      try { user = JSON.parse(localStorage.getItem("aria-auth-user") || "null"); } catch (_e) {}
      if (user && user.name) {
        openAccountSheet(user.name);
      } else if (window.ariaStation.popCard) {
        window.ariaStation.popCard(6);
      }
      setStep(4);
      return;
    }
    setStep(i);
    window.ariaStation.goTo(i);
  }

  if (nav) {
    SECTIONS.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bn-item" + (i === 0 ? " active" : "");
      b.innerHTML = s.icon + "<span>" + s.label + "</span>";
      b.setAttribute("aria-label", s.label);
      b.addEventListener("click", function () { gotoSection(i); });
      nav.appendChild(b);
    });
  }

  /* the step chip follows scrolling through the flat story */
  if (mobile && "IntersectionObserver" in window) {
    var observed = [];
    SECTIONS.forEach(function (s, i) {
      if (!s.target) return;
      var el = document.getElementById(s.target);
      if (el) observed.push({ el: el, i: i });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var hit = observed.filter(function (o) { return o.el === en.target; })[0];
        if (hit) setStep(hit.i);
      });
    }, { rootMargin: "-42% 0px -42% 0px", threshold: 0 });
    observed.forEach(function (o) { io.observe(o.el); });
  }

  /* ---------- account sheet (logout without the hidden topbar) ---------- */
  function openAccountSheet(name) {
    var sheet = document.createElement("div");
    sheet.className = "m-toast ok";
    sheet.style.pointerEvents = "auto";
    sheet.innerHTML = "<b>" + name.replace(/</g, "&lt;") + "</b> · ";
    var out = document.createElement("button");
    out.type = "button";
    out.textContent = "Logout";
    out.style.cssText = "border:0;background:#fff;color:#138a62;font:700 .8rem 'DM Sans',sans-serif;padding:4px 10px;border-radius:99px;cursor:pointer;margin-left:8px";
    out.addEventListener("click", function () {
      if (typeof window.logout === "function") window.logout();
      sheet.remove();
      toast("Signed out", "ok");
    });
    sheet.appendChild(out);
    document.body.appendChild(sheet);
    requestAnimationFrame(function () { sheet.classList.add("show"); });
    setTimeout(function () { sheet.classList.remove("show"); setTimeout(function () { sheet.remove(); }, 400); }, 4000);
  }
  /* logout() is a top-level function declaration in app.js, so it already
     exists as window.logout for the account sheet above. */

  /* ---------- 4 · hamburger drawer ---------- */
  var drawer = $("#mobileDrawer");
  var burger = $("#hamburgerBtn");
  function openDrawer() {
    if (!drawer) return;
    drawer.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add("open"); });
    burger.setAttribute("aria-expanded", "true");
  }
  function closeDrawer() {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    setTimeout(function () { drawer.hidden = true; }, 300);
  }
  if (burger) burger.addEventListener("click", function () {
    drawer && !drawer.hidden ? closeDrawer() : openDrawer();
  });
  if (drawer) {
    $("#drawerBackdrop").addEventListener("click", closeDrawer);
    $("#drawerClose").addEventListener("click", closeDrawer);
    $all(".drawer-item").forEach(function (item) {
      item.addEventListener("click", function () {
        closeDrawer();
        var action = item.getAttribute("data-action");
        if (action === "doctors") window.location.href = "/doctors.html";
        if (action === "hospital") window.location.href = "/hospital.html";
        if (action === "ask") { var askBtn = $("#askAriaHomeButton"); if (askBtn) askBtn.click(); }
        if (action === "theme") { var t = $("#themeToggle"); if (t) t.click(); }
        if (action === "music") { var m = $("#soundToggle"); if (m) m.click(); }
        if (action === "mode3d") {
          body.classList.remove("mobile");       /* let the 3D stage back in (tablets only) */
          var d = $("#dimensionToggle"); if (d) d.click();
        }
      });
    });
    /* 3D is disabled on phones — the drawer entry only makes sense on tablets+ */
    var mode3dItem = $('.drawer-item[data-action="mode3d"]');
    if (mode3dItem && window.matchMedia("(max-width: 767px)").matches) mode3dItem.hidden = true;
  }

  /* ---------- 5 · swipe navigation (sections + calendar months) ---------- */
  var swipeStart = null;
  document.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { swipeStart = null; return; }
    var t = e.target;
    /* never hijack swipes that start on real controls or inside modals */
    if (t.closest("button, a, input, select, textarea, label, .dropzone, .cal-modal, .mobile-bottomnav, .drawer-panel, .pop-backdrop, .station-panel.popped, pre, .m-toast")) {
      swipeStart = null;
      return;
    }
    swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });

  document.addEventListener("touchend", function (e) {
    if (!swipeStart) return;
    var dx = e.changedTouches[0].clientX - swipeStart.x;
    var dy = e.changedTouches[0].clientY - swipeStart.y;
    var dt = Date.now() - swipeStart.t;
    swipeStart = null;
    if (dt > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    /* horizontal section swipe (only in the 2D story) */
    if (body.classList.contains("mode-2d") && !body.classList.contains("modal-open")) {
      var next = Math.max(0, Math.min(4, currentStep + (dx < 0 ? 1 : -1)));
      if (next !== currentStep) {
        gotoSection(next);
        toast(STEP_NAMES[next], "ok");
      }
      return;
    }
  }, { passive: true });

  /* calendar: swipe left/right = next/previous month (matches the ← → buttons) */
  var calGrid = $("#calGrid");
  if (calGrid) {
    var calStart = null;
    calGrid.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) calStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    calGrid.addEventListener("touchend", function (e) {
      if (!calStart) return;
      var dx = e.changedTouches[0].clientX - calStart.x;
      var dy = e.changedTouches[0].clientY - calStart.y;
      calStart = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
      var btn = $(dx < 0 ? "#calNext" : "#calPrev");
      if (btn) btn.click();
    }, { passive: true });
  }

  /* ---------- 6 · dashboard accordion (phones) ---------- */
  if (mobile) {
    body.classList.add("m-acc");
    var dash = $(".dashboard-panel");
    if (dash) {
      var cards = $all(".dashboard-panel > .dashboard-reveal .glass-card");
      cards.forEach(function (card, idx) {
        /* keep the clinical core open; fold the long-tail sections away */
        var keepOpen = card.classList.contains("patient-report-card") ||
                       card.querySelector(".card-title h3") && /decided|Care plan/i.test(card.querySelector(".card-title h3").textContent);
        card.classList.toggle("m-closed", !keepOpen);
        var title = card.querySelector(":scope > .card-title");
        if (!title) return;
        title.setAttribute("role", "button");
        title.setAttribute("tabindex", "0");
        title.setAttribute("aria-expanded", keepOpen ? "true" : "false");
        function toggle() {
          card.classList.toggle("m-closed");
          title.setAttribute("aria-expanded", card.classList.contains("m-closed") ? "false" : "true");
        }
        title.addEventListener("click", function (e) {
          if (e.target.closest("button, a")) return;   /* Print / Clear history keep working */
          toggle();
        });
        title.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        });
      });
    }
  }

  /* ---------- 7 · long-press to copy patient data ---------- */
  var LONG_PRESS_MS = 550;
  ["#phone", "#patientReportName", "#patientName"].forEach(function (sel) {
    var el = $(sel);
    if (!el) return;
    var timer = null;
    function start(e) {
      clear();
      timer = setTimeout(function () {
        var text = (el.textContent || "").trim();
        if (!text || text === "—" || text === "--") return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            toast("Copied: " + text, "ok");
          }, function () { toast("Could not copy", "err"); });
        } else {
          toast(text, "");
        }
      }, LONG_PRESS_MS);
    }
    function clear() { if (timer) { clearTimeout(timer); timer = null; } }
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", clear);
    el.addEventListener("touchmove", clear, { passive: true });
    el.addEventListener("contextmenu", function (e) {
      /* the long-press context menu would interrupt the copy */
      if (timer) { e.preventDefault(); }
    });
  });

  /* ---------- 8 · password visibility toggle (all devices, small win) ---------- */
  var pw = $("#loginPassword");
  if (pw) {
    /* wrap the whole label so the toggle button stays OUTSIDE it — a button
       inside the <label> would leak "Show password" into the input's name */
    var label = pw.closest("label") || pw.parentNode;
    var wrap = document.createElement("span");
    wrap.className = "pw-wrap";
    label.parentNode.insertBefore(wrap, label);
    wrap.appendChild(label);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pw-toggle";
    btn.setAttribute("aria-label", "Show password");
    btn.textContent = "👁";
    var masked = true;
    btn.addEventListener("click", function () {
      masked = !masked;
      pw.type = masked ? "password" : "text";
      btn.setAttribute("aria-label", masked ? "Show password" : "Hide password");
      btn.textContent = masked ? "👁" : "🙈";
    });
    wrap.appendChild(btn);
  }

  /* ---------- 9 · first-visit system theme ---------- */
  /* body starts theme-night; if the OS says light and the user never chose, switch.
     themeBtn.click() persists the choice to localStorage (existing behavior). */
  try {
    var savedTheme = localStorage.getItem("aria-theme");
    var sysLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    if (!savedTheme && sysLight) {
      var tbtn = $("#themeToggle");
      if (tbtn && !document.body.classList.contains("theme-day")) tbtn.click();
    }
  } catch (_e) {}

  /* ---------- 10 · camera / photo-library upload triggers ---------- */
  /* The two hidden inputs live next to #documentInput in index.html. Chosen
     files are injected into the main input so every existing flow (analyze,
     showFile, drag state) keeps working unchanged. */
  function bindCapture(buttonId, inputId) {
    var btn = $(buttonId), input = $(inputId);
    if (!btn || !input) return;
    btn.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      try {
        var transfer = new DataTransfer();
        transfer.items.add(file);
        var main = $("#documentInput");
        if (main) {
          main.files = transfer.files;
          main.dispatchEvent(new Event("change", { bubbles: false }));
        }
      } catch (_e) {}
      input.value = "";   /* allow re-picking the same photo later */
    });
  }
  bindCapture("#cameraCapture", "#cameraInput");
  bindCapture("#photoLibrary", "#libraryInput");
})();
