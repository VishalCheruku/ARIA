/*
  "Ask ARIA" — the single Copilot entry point on the existing dashboard
  (spec §6.1, §4.2), now a full-screen cinematic experience.

  What happens on click (all inside this one overlay, dashboard untouched):
    1. SPLASH   — black stage, giant "Ask ARIA" headline and a dense sparkle
                  band with indigo/sky gradient lines (vanilla-canvas twin of
                  Aceternity's SparklesPreview / SparklesCore). Holds ~2.6s,
                  then vanishes slowly (1.15s fade) and is removed from the
                  DOM. Clicking it skips ahead.
    2. BACKGROUND — always running behind the splash: a full-page sparse
                  sparkle field (density ~100, the "tsparticlesfullpage"
                  layer) plus the SVG "ARIA" wordmark whose violet→blue
                  gradient is revealed only around the pointer
                  (TextHoverEffect twin). Both stay alive for the whole chat.
    3. CARD     — right as the splash fades, the chat card rises from below
                  the viewport to the middle like a card lying asleep on the
                  floor, hinging upright as it comes (1.55s, decelerating,
                  no spin). It then 3-D tilts with the pointer
                  (perspective 1000px, ±10°, the 3d-card twin). Title
                  "Ask the ARIA Bot" sits at translateZ(50), the composer at
                  translateZ(20) — like the original CardItems.
    4. CHAT     — the card IS the copilot: it mints the anonymous 5-minute
                  token (/api/copilot-token), opens a session
                  (/copilot/api/session/start → greeting), and streams answers
                  from /copilot/api/chat (SSE: meta/delta/done/error) into
                  chat bubbles. Emergency flags raise the red banner with the
                  108 call CTA; sources are rendered under answers; a dead
                  session transparently reboots once.

  Isolation contract (unchanged):
   - Fully self-contained; every entry point wrapped in try/catch — a failure
     only disables this button, never the dashboard.
   - Login is NEVER required (the token endpoint is anonymous).
   - Embedded mode talks to the same-origin /copilot proxy. If
     window.ARIA_COPILOT_URL points at a standalone deployment, the legacy
     new-tab handoff is used instead (the proxy does not exist there).
   - On any failure to even build the overlay: calm toast, nothing else.

  Housekeeping: service-worker VERSION must be bumped whenever this file or
  its stylesheet changes, or PWA users keep the old experience for a week.
*/
(function () {
  "use strict";

  var EMERGENCY_NUMBER = "108";

  /* ============================ tiny helpers ============================ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function prefersReducedMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (_error) { return false; }
  }

  function coarsePointer() {
    try { return window.matchMedia("(hover: none), (pointer: coarse)").matches; }
    catch (_error) { return false; }
  }

  function currentlyDisplayedPatientName() {
    try {
      var node = document.querySelector("#patientReportName");
      var name = node ? String(node.textContent || "").trim() : "";
      /* placeholder states rendered by the dashboard are not patients */
      if (!name || /^(—|-|unknown( patient)?|n\/a)$/i.test(name) ||
          /reading clinical signal/i.test(name) || /awaiting/i.test(name)) return "";
      return name;
    } catch (_error) {
      return "";
    }
  }

  function showToast(message) {
    try {
      var existing = document.getElementById("askAriaToast");
      if (existing) existing.remove();
      var toast = el("div");
      toast.id = "askAriaToast";
      toast.setAttribute("role", "status");
      toast.style.cssText =
        "position:fixed;bottom:96px;right:24px;z-index:99999;max-width:280px;" +
        "background:#0f172a;color:#f8fafc;padding:12px 16px;border-radius:12px;" +
        "font:500 13px/1.4 'Segoe UI',system-ui,sans-serif;box-shadow:0 8px 24px rgba(2,6,23,.35);";
      toast.textContent = message;
      document.body.appendChild(toast);
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 4000);
    } catch (_error) { /* toasts are cosmetic — ignore failures */ }
  }

  /* ======================================================================
     SPARKLE FIELD — canvas twin of Aceternity's SparklesCore (tsParticles)
     Twinkling dots: opacity oscillates 0.1→1, size oscillates min→max, slow
     random drift with edge wrap. Count follows the tsParticles density model
     (value × area / 800 000), so `density: 1200` on the small splash band and
     `density: 100` fullscreen land exactly where the originals do.
     ====================================================================== */
  function createSparkleField(host, options) {
    var opts = {
      density: 100,      /* tsParticles particleDensity */
      minSize: 0.6,
      maxSize: 1.4,
      color: "255,255,255",
      drift: 5,          /* px per second */
      twinkle: 1,        /* speed multiplier for opacity/size oscillation */
      cap: 520           /* hard perf ceiling */
    };
    Object.assign(opts, options || {});
    if (prefersReducedMotion()) opts.drift = 0;

    var canvas = el("canvas", "aae-sparkle-canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    if (!ctx) {
      return { destroy: function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); } };
    }

    var particles = [];
    var width = 0, height = 0;
    var raf = 0, destroyed = false, lastTs = 0;

    function between(a, b) { return a + Math.random() * (b - a); }

    function makeParticle() {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        angle: Math.random() * Math.PI * 2,
        speed: between(0.35, 1) * opts.drift,
        min: opts.minSize,
        span: Math.max(opts.maxSize - opts.minSize, 0.01),
        sizePhase: Math.random() * Math.PI * 2,
        sizeSpeed: between(0.7, 1.9) * opts.twinkle,
        glowPhase: Math.random() * Math.PI * 2,
        glowSpeed: between(0.5, 1.6) * opts.twinkle
      };
    }

    function resize() {
      if (destroyed) return;
      var rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round((opts.density * width * height) / 800000);
      count = Math.max(6, Math.min(opts.cap, count));
      particles = [];
      for (var i = 0; i < count; i++) particles.push(makeParticle());
    }

    function frame(ts) {
      if (destroyed) return;
      var dt = Math.min(((ts - lastTs) || 16) / 1000, 0.05);
      lastTs = ts;
      var t = ts / 1000;
      ctx.clearRect(0, 0, width, height);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
        if (p.x < -4) p.x = width + 4; else if (p.x > width + 4) p.x = -4;
        if (p.y < -4) p.y = height + 4; else if (p.y > height + 4) p.y = -4;
        var size = Math.max(p.min + p.span * (0.5 + 0.5 * Math.sin(p.sizePhase + t * p.sizeSpeed)), 0.2);
        var alpha = 0.1 + 0.9 * (0.5 + 0.5 * Math.sin(p.glowPhase + t * p.glowSpeed));
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + opts.color + "," + alpha.toFixed(3) + ")";
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    var resizeObserver = null;
    try {
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
      }
    } catch (_error) { /* fall back to the window resize listener */ }
    window.addEventListener("resize", resize);

    resize();
    raf = requestAnimationFrame(frame);

    return {
      destroy: function () {
        destroyed = true;
        if (raf) cancelAnimationFrame(raf);
        try { if (resizeObserver) resizeObserver.disconnect(); } catch (_error) {}
        window.removeEventListener("resize", resize);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  /* ======================================================================
     WORDMARK — SVG twin of Aceternity's TextHoverEffect
     Two stacked <text> layers: a dim slate outline that fades in on hover,
     and a violet→indigo→pink→blue gradient stroke revealed only inside a
     blurred white circle that chases the pointer (SVG mask). Pointer coords
     are mapped into the 300×100 viewBox and eased every frame.
     ====================================================================== */
  var wordmarkUid = 0;

  function createWordmark(host) {
    wordmarkUid += 1;
    var uid = "aaeWord" + wordmarkUid + "_" + Date.now().toString(36);
    var SVG_NS = "http://www.w3.org/2000/svg";

    var box = el("div", "aae-wordmark-box");
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 300 100");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.classList.add("aae-wordmark-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
      "<defs>" +
        '<linearGradient id="' + uid + 'Grad" x1="0%" y1="0%" x2="100%" y2="0%">' +
          '<stop offset="0%" stop-color="#7c3aed"/>' +
          '<stop offset="25%" stop-color="#6366f1"/>' +
          '<stop offset="50%" stop-color="#ec4899"/>' +
          '<stop offset="75%" stop-color="#8b5cf6"/>' +
          '<stop offset="100%" stop-color="#3b82f6"/>' +
        "</linearGradient>" +
        '<filter id="' + uid + 'Blur" x="-120%" y="-120%" width="340%" height="340%">' +
          '<feGaussianBlur stdDeviation="12"/>' +
        "</filter>" +
        '<mask id="' + uid + 'Mask" maskUnits="userSpaceOnUse" x="-20" y="-20" width="340" height="140">' +
          '<rect x="-20" y="-20" width="340" height="140" fill="black"/>' +
          '<circle id="' + uid + 'Dot" cx="-500" cy="-500" r="50" fill="white" filter="url(#' + uid + 'Blur)"/>' +
        "</mask>" +
      "</defs>" +
      '<text class="aae-word-dim" x="150" y="50" text-anchor="middle" dominant-baseline="central" ' +
        'fill="none" stroke="#e2e8f0" stroke-width="0.3" font-size="94" font-weight="700" ' +
        'letter-spacing="2">ARIA</text>' +
      '<text class="aae-word-glow" x="150" y="50" text-anchor="middle" dominant-baseline="central" ' +
        'fill="none" stroke="url(#' + uid + 'Grad)" stroke-width="1.5" font-size="94" font-weight="700" ' +
        'letter-spacing="2" mask="url(#' + uid + 'Mask)">ARIA</text>';

    box.appendChild(svg);
    host.appendChild(box);

    var dot = svg.querySelector("#" + uid + "Dot");
    var targetX = -500, targetY = -500;
    var posX = -500, posY = -500;
    var raf = 0, destroyed = false, leaveTimer = 0;

    function toViewSpace(clientX, clientY) {
      var rect = box.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: ((clientX - rect.left) / rect.width) * 300,
        y: ((clientY - rect.top) / rect.height) * 100
      };
    }

    function onMove(event) {
      var point = toViewSpace(event.clientX, event.clientY);
      if (!point) return;
      if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = 0; }
      targetX = point.x;
      targetY = point.y;
      svg.classList.add("aae-word-on");
    }

    function onLeave() {
      targetX = -500;
      targetY = -500;
      /* the dim outline fades out slowly, exactly like the React original */
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () {
        leaveTimer = 0;
        if (targetX === -500) svg.classList.remove("aae-word-on");
      }, 1000);
    }

    function loop() {
      if (destroyed) return;
      posX += (targetX - posX) * 0.16;
      posY += (targetY - posY) * 0.16;
      dot.setAttribute("cx", posX.toFixed(1));
      dot.setAttribute("cy", posY.toFixed(1));
      raf = requestAnimationFrame(loop);
    }

    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerdown", onMove);
    box.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(loop);

    return {
      destroy: function () {
        destroyed = true;
        if (raf) cancelAnimationFrame(raf);
        if (leaveTimer) clearTimeout(leaveTimer);
        box.removeEventListener("pointermove", onMove);
        box.removeEventListener("pointerdown", onMove);
        box.removeEventListener("pointerleave", onLeave);
        if (box.parentNode) box.parentNode.removeChild(box);
      }
    };
  }

  /* ======================================================================
     3-D TILT — pointer-driven twin of Aceternity's CardContainer
     rotateX/rotateY ±10° from the pointer position inside the scene, eased
     every frame; springs back to flat on leave. Skipped for touch devices
     (tilting while scrolling a chat is hostile) and reduced motion.
     ====================================================================== */
  function createTilt(scene, target) {
    if (coarsePointer() || prefersReducedMotion()) {
      return { destroy: function () {} };
    }
    var rx = 0, ry = 0, targetX = 0, targetY = 0;
    var raf = 0, destroyed = false;

    function onMove(event) {
      var rect = scene.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var nx = (event.clientX - rect.left) / rect.width - 0.5;
      var ny = (event.clientY - rect.top) / rect.height - 0.5;
      targetY = nx * 2 * 10;   /* rotateY, ±10deg */
      targetX = -ny * 2 * 10;  /* rotateX, ±10deg */
      kick();
    }

    function onLeave() {
      targetX = 0;
      targetY = 0;
      kick();
    }

    function loop() {
      if (destroyed) return;
      rx += (targetX - rx) * 0.14;
      ry += (targetY - ry) * 0.14;
      target.style.transform = "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
      if (targetX === 0 && targetY === 0 &&
          Math.abs(targetX - rx) < 0.02 && Math.abs(targetY - ry) < 0.02) {
        raf = 0;   /* settled flat — stop the loop until the pointer returns */
        target.style.transform = "";
        return;
      }
      raf = requestAnimationFrame(loop);
    }

    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    scene.addEventListener("pointermove", onMove);
    scene.addEventListener("pointerleave", onLeave);
    kick();

    return {
      destroy: function () {
        destroyed = true;
        if (raf) cancelAnimationFrame(raf);
        scene.removeEventListener("pointermove", onMove);
        scene.removeEventListener("pointerleave", onLeave);
        target.style.transform = "";
      }
    };
  }

  /* ======================================================================
     CHAT ENGINE — the Copilot protocol, embedded in the card
       POST /api/copilot-token {name}          → {token}   (anonymous, 5 min)
       POST /copilot/api/session/start {token} → {session_id, greeting}
       POST /copilot/api/chat {session_id,…}   → SSE meta/delta/done/error
     ====================================================================== */
  function createChat(parts, aborter) {
    var state = {
      token: "", sessionId: "",
      booting: false, busy: false, ready: false,
      flagged: false, rebooted: false
    };
    var stick = true;   /* autoscroll follows the stream unless the user scrolled up */

    parts.messages.addEventListener("scroll", function () {
      stick = parts.messages.scrollHeight - parts.messages.scrollTop - parts.messages.clientHeight < 90;
    });

    function scrollBottom(force) {
      if (force || stick) parts.messages.scrollTop = parts.messages.scrollHeight;
    }

    function setComposer(inputOn, sendOn) {
      parts.input.disabled = !inputOn;
      parts.send.disabled = !sendOn;
    }

    function removeNode(node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }

    function bubble(role, text) {
      var row = el("div", "aae-msg aae-msg-" + role);
      var body = el("div", "aae-bubble");
      body.textContent = text;
      row.appendChild(body);
      parts.messages.appendChild(row);
      scrollBottom(true);
      return row;
    }

    function typingBubble() {
      var row = el("div", "aae-msg aae-msg-aria");
      var body = el("div", "aae-bubble aae-bubble-typing");
      for (var i = 0; i < 3; i++) body.appendChild(el("span", "aae-dot"));
      row.appendChild(body);
      parts.messages.appendChild(row);
      scrollBottom(true);
      return row;
    }

    function errorBubble(message, retryAction) {
      var row = el("div", "aae-msg aae-msg-aria");
      var body = el("div", "aae-bubble aae-bubble-error");
      body.appendChild(document.createTextNode(message));
      if (retryAction) {
        var retry = el("button", "aae-retry", "Try again");
        retry.type = "button";
        retry.addEventListener("click", function () {
          removeNode(row);
          retryAction();
        });
        body.appendChild(retry);
      }
      row.appendChild(body);
      parts.messages.appendChild(row);
      scrollBottom(true);
    }

    function showBanner() {
      if (state.flagged) return;
      state.flagged = true;
      parts.banner.hidden = false;
    }

    function sourcesRow(sources) {
      if (!sources || !sources.length) return;
      var row = el("div", "aae-msg aae-msg-aria");
      var line = el("div", "aae-sources");
      line.appendChild(document.createTextNode("Sources: "));
      sources.slice(0, 4).forEach(function (source, index) {
        if (index) line.appendChild(document.createTextNode("  "));
        line.appendChild(el("span", "aae-source-chip",
          String((source && (source.source_title || source.category)) || "KB")));
      });
      row.appendChild(line);
      parts.messages.appendChild(row);
      scrollBottom();
    }

    function boot(onReady) {
      if (state.booting) return;
      state.booting = true;
      state.ready = false;
      setComposer(false, false);
      var waiting = typingBubble();

      fetch("/api/copilot-token", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: currentlyDisplayedPatientName() }),
        signal: aborter.signal
      })
        .then(function (response) {
          if (!response.ok) throw new Error("token " + response.status);
          return response.json();
        })
        .then(function (data) {
          if (!data || !data.token) throw new Error("no token in response");
          state.token = data.token;
          return fetch("/copilot/api/session/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: state.token }),
            signal: aborter.signal
          });
        })
        .then(function (response) {
          if (!response.ok) throw new Error("session " + response.status);
          return response.json();
        })
        .then(function (data) {
          if (aborter.signal.aborted) return;
          state.sessionId = String((data && data.session_id) || "");
          removeNode(waiting);
          bubble("aria", String((data && data.greeting) ||
            "Hello, I can help answer questions about your recovery. What's on your mind?"));
          state.booting = false;
          state.ready = true;
          setComposer(true, true);
          if (typeof onReady === "function") onReady();
          try { parts.input.focus({ preventScroll: true }); } catch (_error) {}
        })
        .catch(function () {
          if (aborter.signal.aborted) return;
          removeNode(waiting);
          state.booting = false;
          errorBubble(
            "ARIA can't reach the Copilot right now. Your dashboard is unaffected — please try again shortly.",
            function () { boot(onReady); });
        });
    }

    function send(text) {
      if (!state.ready || state.busy || !text) return;
      bubble("user", text);
      state.busy = true;
      setComposer(true, false);

      var waiting = typingBubble();
      var answerRow = null, answerBody = null, answerText = "";
      var settled = false;

      function ensureAnswer() {
        if (answerRow) return;
        removeNode(waiting);
        answerRow = el("div", "aae-msg aae-msg-aria");
        answerBody = el("div", "aae-bubble");
        answerRow.appendChild(answerBody);
        parts.messages.appendChild(answerRow);
        scrollBottom(true);
      }

      function finish(errorText) {
        if (settled) return;
        settled = true;
        removeNode(waiting);
        if (errorText) errorBubble(errorText);
        state.busy = false;
        setComposer(true, true);
        scrollBottom();
      }

      function onEvent(eventName, payload) {
        if (settled) return;
        if (eventName === "meta") {
          if (payload.flagged_emergency) showBanner();
        } else if (eventName === "delta") {
          ensureAnswer();
          answerText += String(payload.text || "");
          answerBody.textContent = answerText;
          scrollBottom();
        } else if (eventName === "done") {
          ensureAnswer();
          var finalText = String(payload.text || answerText || "");
          if (finalText) answerBody.textContent = finalText;
          if (payload.flagged_emergency) showBanner();
          sourcesRow(payload.sources);
          finish();
        } else if (eventName === "error") {
          var message = String(payload.text || "");
          /* the 5-minute session died mid-chat: transparently reboot once */
          if (/session has ended|expired/i.test(message) && !state.rebooted) {
            settled = true;
            removeNode(waiting);
            state.busy = false;
            setComposer(true, false);
            state.sessionId = "";
            state.ready = false;
            state.rebooted = true;
            boot(function () { send(text); });
          } else {
            finish(message || "Copilot is temporarily unavailable.");
          }
        }
      }

      fetch("/copilot/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: state.sessionId, message: text }),
        signal: aborter.signal
      })
        .then(function (response) {
          if (aborter.signal.aborted) return null;
          if (!response.ok || !response.body) throw new Error("chat " + response.status);
          var reader = response.body.getReader();
          var decoder = new TextDecoder();
          var buffer = "";

          function pump() {
            return reader.read().then(function (chunk) {
              if (aborter.signal.aborted || settled) return;
              if (chunk.done) {
                /* stream ended without done/error — treat as unavailable */
                finish("Copilot is temporarily unavailable. Your dashboard and care plan are unaffected.");
                return;
              }
              buffer += decoder.decode(chunk.value, { stream: true });
              var separator;
              while ((separator = buffer.indexOf("\n\n")) >= 0) {
                var block = buffer.slice(0, separator);
                buffer = buffer.slice(separator + 2);
                var eventName = "message", data = "";
                block.split("\n").forEach(function (line) {
                  if (line.indexOf("event:") === 0) eventName = line.slice(6).trim();
                  else if (line.indexOf("data:") === 0) data += line.slice(5).trim();
                });
                if (!data) continue;
                var payload = {};
                try { payload = JSON.parse(data); } catch (_error) { payload = {}; }
                onEvent(eventName, payload);
              }
              return pump();
            });
          }
          return pump();
        })
        .catch(function () {
          if (!aborter.signal.aborted) {
            finish("Copilot is temporarily unavailable. Your dashboard and care plan are unaffected.");
          }
        });
    }

    parts.form.addEventListener("submit", function (event) {
      event.preventDefault();
      var text = String(parts.input.value || "").trim();
      if (!text || !state.ready || state.busy) return;
      parts.input.value = "";
      send(text);
    });

    return { boot: boot };
  }

  /* ======================================================================
     EXPERIENCE — overlay DOM + the splash→fade→rise timeline
     ====================================================================== */
  function buildExperience() {
    var root = el("div", "aae-root");
    root.id = "aaeRoot";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Ask ARIA — recovery copilot chat");

    /* layer 1: persistent full-page sparkles (the "tsparticlesfullpage") */
    var starHost = el("div", "aae-stars");
    root.appendChild(starHost);
    var stars = createSparkleField(starHost, { density: 100, minSize: 0.6, maxSize: 1.4, drift: 7 });

    /* layer 2: the gradient-on-hover ARIA wordmark */
    var wordHost = el("div", "aae-wordmark");
    root.appendChild(wordHost);
    var wordmark = createWordmark(wordHost);

    /* layer 3: the chat card — rises later, tilts forever */
    var cardLayer = el("div", "aae-card-layer");
    var enter = el("div", "aae-card-enter");
    var scene = el("div", "aae-card-scene");
    var tiltBox = el("div", "aae-card-tilt");
    var card = el("section", "aae-card");
    card.setAttribute("aria-label", "Ask the ARIA Bot");

    var head = el("div", "aae-card-head");
    var headText = el("div");
    headText.appendChild(el("h2", "aae-card-title", "Ask the ARIA Bot"));
    headText.appendChild(el("p", "aae-card-sub", "Grounded in your recovery knowledge base"));
    var closeButton = el("button", "aae-close", "✕");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close Ask ARIA");
    head.appendChild(headText);
    head.appendChild(closeButton);
    card.appendChild(head);

    var banner = el("div", "aae-banner");
    banner.hidden = true;
    banner.setAttribute("role", "alert");
    banner.appendChild(el("span", null,
      "This may be urgent. Contact your care team or call " + EMERGENCY_NUMBER + " now."));
    var bannerCall = el("a", "aae-banner-call", "Call " + EMERGENCY_NUMBER);
    bannerCall.href = "tel:" + EMERGENCY_NUMBER;
    banner.appendChild(bannerCall);
    card.appendChild(banner);

    var messages = el("div", "aae-messages");
    messages.setAttribute("aria-live", "polite");
    card.appendChild(messages);

    var form = el("form", "aae-composer");
    var input = el("input", "aae-input");
    input.type = "text";
    input.placeholder = "Type your recovery question…";
    input.autocomplete = "off";
    input.maxLength = 600;
    input.disabled = true;
    input.setAttribute("aria-label", "Message to ARIA");
    var send = el("button", "aae-send", "Send");
    send.type = "submit";
    send.disabled = true;
    form.appendChild(input);
    form.appendChild(send);
    card.appendChild(form);

    card.appendChild(el("p", "aae-fineprint",
      "ARIA answers from your recovery knowledge base — it is not a doctor. In an emergency, call " +
      EMERGENCY_NUMBER + "."));

    tiltBox.appendChild(card);
    scene.appendChild(tiltBox);
    enter.appendChild(scene);
    cardLayer.appendChild(enter);
    root.appendChild(cardLayer);

    /* layer 4: the intro splash — "Ask ARIA" + dense sparkle band */
    var splash = el("div", "aae-splash");
    splash.appendChild(el("h1", "aae-splash-title", "Ask ARIA"));
    var band = el("div", "aae-splash-band");
    ["ln-indigo-b", "ln-indigo", "ln-sky-b", "ln-sky"].forEach(function (name) {
      band.appendChild(el("div", "ln " + name));
    });
    var bandSparkles = createSparkleField(band, {
      density: 1200, minSize: 0.4, maxSize: 1, cap: 420, twinkle: 1.7, drift: 14
    });
    var veil = el("div", "aae-splash-veil");
    band.appendChild(veil);
    splash.appendChild(band);
    root.appendChild(splash);

    return {
      root: root,
      splash: splash,
      closeButton: closeButton,
      enterElement: enter,
      stars: stars,
      wordmark: wordmark,
      bandSparkles: bandSparkles,
      tiltController: createTilt(scene, tiltBox),
      input: input,
      parts: { messages: messages, banner: banner, form: form, input: input, send: send }
    };
  }

  function openExperience() {
    if (document.getElementById("aaeRoot")) return true;   /* already open */

    var built;
    try {
      built = buildExperience();
    } catch (_error) {
      showToast("Copilot is temporarily unavailable");
      return false;
    }

    var root = built.root;
    document.body.appendChild(root);
    document.documentElement.classList.add("aae-lock");
    document.body.classList.add("aae-lock");

    var aborter = ("AbortController" in window) ? new AbortController() : null;
    var chat = createChat(built.parts, {
      get signal() { return aborter ? aborter.signal : { aborted: false }; },
      abort: function () { try { if (aborter) aborter.abort(); } catch (_error) {} }
    });
    /* mint the token + open the session WHILE the splash plays, so the
       greeting is usually already waiting when the card lands */
    chat.boot();

    var closed = false;
    var timers = [];
    var splashDone = false;
    var holdMs = prefersReducedMotion() ? 1200 : 2600;

    function beginExit() {
      if (splashDone) return;
      splashDone = true;
      root.classList.add("aae-splash-out");
      /* the card starts rising while the splash is still dissolving */
      timers.push(setTimeout(function () { built.enterElement.classList.add("aae-run"); }, 420));
      timers.push(setTimeout(function () {
        if (built.splash.parentNode) built.splash.parentNode.removeChild(built.splash);
        built.bandSparkles.destroy();
      }, 1500));
      timers.push(setTimeout(function () {
        try { built.input.focus({ preventScroll: true }); } catch (_error) {}
      }, holdMs + 2100));
    }

    timers.push(setTimeout(beginExit, holdMs));
    built.splash.addEventListener("click", beginExit);

    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      /* keep the dashboard's own hotkeys from firing while chatting */
      event.stopPropagation();
    }

    function close() {
      if (closed) return;
      closed = true;
      timers.forEach(clearTimeout);
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.classList.remove("aae-lock");
      document.body.classList.remove("aae-lock");
      root.classList.add("aae-closing");
      aborter.abort();
      built.stars.destroy();
      built.wordmark.destroy();
      built.tiltController.destroy();
      built.bandSparkles.destroy();
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
      }, 480);
    }

    document.addEventListener("keydown", onKey, true);
    built.closeButton.addEventListener("click", close);
    return true;
  }

  /* ==================== legacy new-tab handoff ====================
     Only used when window.ARIA_COPILOT_URL points at a standalone
     Copilot deployment (no same-origin proxy to embed against). */
  function copilotChatUrl(token) {
    try {
      var standalone = window.ARIA_COPILOT_URL;
      if (standalone && typeof standalone === "string" && standalone.trim()) {
        return standalone.replace(/\/+$/, "") + "/chat?token=" + encodeURIComponent(token);
      }
    } catch (_error) { /* reading window config can never break us */ }
    return window.location.origin + "/copilot/chat?token=" + encodeURIComponent(token);
  }

  function openCopilotLegacy(button) {
    try { button.disabled = true; } catch (_error) {}
    fetch("/api/copilot-token", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: currentlyDisplayedPatientName() })
    })
      .then(function (response) {
        if (!response.ok) throw new Error("token request failed: " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.token) throw new Error("no token in response");
        var opened = window.open(copilotChatUrl(data.token), "_blank", "noopener");
        if (!opened) showToast("Allow pop-ups to open the ARIA Copilot.");
      })
      .catch(function () {
        showToast("Copilot is temporarily unavailable");
      })
      .finally(function () {
        try { button.disabled = false; } catch (_error) {}
      });
  }

  /* ============================== wiring ============================== */

  function init() {
    try {
      /* Single entry point: the ✦ Ask ARIA action in the top navigation,
         shared by the 3D and 2D home modes (and mobile.js drawer). */
      var button = document.getElementById("askAriaHomeButton");
      if (!button) return;
      button.addEventListener("click", function () {
        try {
          if (window.ARIA_COPILOT_URL && String(window.ARIA_COPILOT_URL).trim()) {
            openCopilotLegacy(button);
            return;
          }
          openExperience();
        } catch (_error) {
          /* the click handler itself must never throw into the main app */
          try { button.disabled = true; } catch (_ignored) {}
          showToast("Copilot is temporarily unavailable");
        }
      });
    } catch (_error) {
      /* if even wiring the listener fails, the dashboard is untouched */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
