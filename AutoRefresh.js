'use strict';
(function () {
  // Settings keys
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_CONFIGURED = 'configured';

  // Runtime
  let currentIntervalSec = 30; // ✅ default 30 seconds
  let countdownAnim = null;
  const canvas = document.getElementById('timerCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  // Initialize extension
  $(document).ready(function () {
    tableau.extensions.initializeAsync({ configure }).then(() => {
      alert("✅ Extension initialized");

      // Listen for changes
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        (event) => {
          console.log("⚡ Settings changed → applying new settings");
          alert("Settings changed");
          applySettingsAndStart(event.newSettings);
        }
      );

      const configured = tableau.extensions.settings.get(KEY_CONFIGURED);
      alert("Configured flag = " + configured);

      if (configured === '1') {
        console.log("Extension already configured → restoring settings");
        alert("Restoring settings");
        applySettingsAndStart(tableau.extensions.settings.getAll());
      } else {
        console.log("Extension not yet configured → opening dialog");
        alert("First-time use → opening dialog");
        configure();
      }
    }).catch(err => {
      console.error('Initialize error', err);
      alert("Initialize error: " + JSON.stringify(err));
    });
  });

  // Open configuration dialog
  function configure() {
    const popupUrl = "https://bcs-041.github.io/Dummy-Extension/AutoRefreshDialog.html";
    console.log("Opening dialog:", popupUrl);
    alert("Opening dialog: " + popupUrl);

    tableau.extensions.ui.displayDialogAsync(popupUrl, null, { height: 250, width: 300 })
      .then((closePayload) => {
        console.log("Dialog closed, payload:", closePayload);
        alert("Dialog closed, payload = " + closePayload);
        applySettingsAndStart(tableau.extensions.settings.getAll());
      })
      .catch((err) => {
        if (err && err.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          console.log("Dialog closed by user");
          alert("Dialog closed by user");
        } else {
          console.error("Dialog error", err);
          alert("Dialog error: " + JSON.stringify(err));
        }
      });
  }

  // Apply settings and start timer
  function applySettingsAndStart(settings) {
    stopTimer();

    if (settings[KEY_INTERVAL_SEC]) {
      const v = parseInt(settings[KEY_INTERVAL_SEC], 10);
      if (!isNaN(v) && v > 0) currentIntervalSec = v;
    }

    console.log("⏱ Starting timer:", currentIntervalSec, "sec");
    alert("⏱ Starting timer: " + currentIntervalSec + " sec");

    startCircularTimer(currentIntervalSec, () => applySettingsAndStart(settings));
  }

  // Stop timer if running
  function stopTimer() {
    if (countdownAnim) {
      cancelAnimationFrame(countdownAnim);
      countdownAnim = null;
    }
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Circular timer
  function startCircularTimer(seconds, onComplete) {
    if (!ctx) return;
    seconds = Math.max(1, Math.floor(Number(seconds) || 1));
    const startTime = Date.now();

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function drawFrame() {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(seconds - elapsed, 0);

      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const w = canvas.width / dpr, h = canvas.height / dpr;
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) / 2 - 6;

      // background circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e6e9ee'; ctx.lineWidth = 8; ctx.stroke();

      // progress arc
      const progressAngle = ((seconds - remaining) / seconds) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + progressAngle, false);
      ctx.strokeStyle = '#0d6efd'; ctx.lineWidth = 8; ctx.stroke();

      // time text
      ctx.fillStyle = '#222';
      ctx.font = `${Math.floor(radius / 1.6)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(formatTime(remaining), cx, cy);

      if (remaining > 0) {
        countdownAnim = requestAnimationFrame(drawFrame);
      } else {
        countdownAnim = null;
        setTimeout(() => { if (typeof onComplete === 'function') onComplete(); }, 150);
      }
    }

    if (countdownAnim) cancelAnimationFrame(countdownAnim);
    drawFrame();
  }

  // Expose configure globally (optional)
  window.AutoRefreshConfigure = configure;
})();
