/*
  "Ask ARIA" — the single Copilot entry point on the existing dashboard
  (spec §6.1, §4.2).

  Isolation contract:
   - This file is fully self-contained and never throws into the main app:
     every handler is wrapped in try/catch, and a failure only disables this
     button — nothing else on the dashboard is touched.
   - It fetches a short-lived signed token (5-minute expiry) from the main
     backend, then opens the Copilot in a NEW TAB with the token in the URL
     query. No patient object is ever embedded in the page or the URL.
   - Default (embedded) mode: the Copilot runs alongside the main app as a
     child process and is proxied on THIS origin at /copilot, so the button
     opens `${origin}/copilot/chat?token=...` — one port, one deploy.
   - Set window.ARIA_COPILOT_URL to open a separately-hosted Copilot instead
     (standalone mode).
   - If token minting fails, the button shows the calm toast "Copilot is
     temporarily unavailable" and nothing else happens.
*/
(function () {
  "use strict";

  function copilotChatUrl(token) {
    try {
      var standalone = window.ARIA_COPILOT_URL;
      if (standalone && typeof standalone === "string" && standalone.trim()) {
        return standalone.replace(/\/+$/, "") + "/chat?token=" + encodeURIComponent(token);
      }
    } catch (_error) { /* reading window config can never break us */ }
    /* Embedded mode: the Copilot lives behind this same origin. */
    return window.location.origin + "/copilot/chat?token=" + encodeURIComponent(token);
  }

  function currentlyDisplayedPatientName() {
    try {
      var node = document.querySelector("#patientReportName");
      var name = node ? String(node.textContent || "").trim() : "";
      /* placeholder states rendered by the dashboard are not patients */
      if (!name || name === "—" || /reading clinical signal/i.test(name) || /awaiting/i.test(name)) return "";
      return name;
    } catch (_error) {
      return "";
    }
  }

  function showToast(message) {
    try {
      var existing = document.getElementById("askAriaToast");
      if (existing) existing.remove();
      var toast = document.createElement("div");
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
    } catch (_error) {
      /* toasts are cosmetic — ignore failures */
    }
  }

  function setBusy(button, busy) {
    try {
      button.disabled = busy;
      button.classList.toggle("ask-aria-fab--busy", busy);
    } catch (_error) { /* never break the page over button state */ }
  }

  function openCopilot(button) {
    setBusy(button, true);
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
        /* Spec §6.1 step 3: on ANY failure, a calm toast and nothing else. */
        showToast("Copilot is temporarily unavailable");
      })
      .finally(function () {
        setBusy(button, false);
      });
  }

  function init() {
    try {
      var button = document.getElementById("askAriaButton");
      if (!button) return;
      button.addEventListener("click", function () {
        try {
          openCopilot(button);
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
