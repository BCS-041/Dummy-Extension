'use strict';
(function () {
  // SETTINGS KEYS
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  // runtime
  let activeDatasourceIdList = [];
  let uniqueDataSources = [];
  let countdownAnim = null;
  let currentIntervalSec = 60 * 15; // default 15 minutes

  // Canvas
  const canvas = document.getElementById('timerCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  // Initialize extension
  $(document).ready(function () {
    tableau.extensions.initializeAsync({ configure }).then(() => {
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        (event) => {
          applySettingsAndStart(event.newSettings);
        }
      );

      const configured = tableau.extensions.settings.get(KEY_CONFIGURED);
      if (configured === '1') {
        applySettingsAndStart(tableau.extensions.settings.getAll());
      } else {
        configure(); // force dialog on first load
      }

      // Draw idle circle if nothing configured yet
      if (ctx) {
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, canvas.width/2 - 6, 0, 2*Math.PI);
        ctx.strokeStyle = "#e6e6e6";
        ctx.lineWidth = 8;
        ctx.stroke();
      }
    }).catch(err => {
      console.error('Initialize error', err);
    });
  });

  // Open the dialog (also bound to Configure menu)
  function configure() {
    const popupUrl = "AutoRefreshDialog.html"; // ✅ relative path inside extension folder
    tableau.extensions.ui.displayDialogAsync(popupUrl, '', { height: 520, width: 500 })
      .then(() => {
        applySettingsAndStart(tableau.extensions.settings.getAll());
      })
      .catch((err) => {
        if (err && err.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          console.log('Dialog closed by user');
        } else {
          console.error('Dialog error', err);
        }
      });
  }

  // Apply settings object and start refresh/timer
  function applySettingsAndStart(settings) {
    stopAllTimers();

    if (settings[KEY_SELECTED_DS]) {
      try {
        activeDatasourceIdList = JSON.parse(settings[KEY_SELECTED_DS]);
        if (!Array.isArray(activeDatasourceIdList)) activeDatasourceIdList = [];
      } catch {
        activeDatasourceIdList = [];
      }
    } else {
      activeDatasourceIdList = [];
    }

    if (settings[KEY_INTERVAL_SEC]) {
      const v = parseInt(settings[KEY_INTERVAL_SEC], 10);
      if (!isNaN(v) && v > 0) currentIntervalSec = v;
    }

    collectUniqueDataSources().then(() => {
      triggerRefreshCycle();
    }).catch(err => {
      console.error('Error collecting datasources', err);
    });
  }

  // collect datasources from each worksheet
  function collectUniqueDataSources() {
    return new Promise((resolve, reject) => {
      try {
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        const uniqueIds = new Set();
        uniqueDataSources = [];

        const promises = dashboard.worksheets.map(ws =>
          ws.getDataSourcesAsync().then(dsList => {
            dsList.forEach(ds => {
              if (activeDatasourceIdList.length === 0 || activeDatasourceIdList.indexOf(ds.id) >= 0) {
                if (!uniqueIds.has(ds.id)) {
                  uniqueIds.add(ds.id);
                  uniqueDataSources.push(ds);
                }
              }
            });
          })
        );

        Promise.all(promises).then(resolve).catch(reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  // Refresh datasources then restart timer
  function triggerRefreshCycle() {
    if (!uniqueDataSources || uniqueDataSources.length === 0) {
      startCircularTimer(currentIntervalSec, triggerRefreshCycle);
      return;
    }

    const refreshPromises = uniqueDataSources.map(ds =>
      ds.refreshAsync().catch(err => {
        console.warn(`Refresh failed for ${ds.name}`, err);
      })
    );

    Promise.all(refreshPromises).then(() => {
      startCircularTimer(currentIntervalSec, triggerRefreshCycle);
    });
  }

  // Stop timers
  function stopAllTimers() {
    if (countdownAnim) {
      cancelAnimationFrame(countdownAnim);
      countdownAnim = null;
    }
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
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
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function drawFrame() {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(seconds - elapsed, 0);

      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 6;

      // background circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e6e6e6';
      ctx.lineWidth = 8;
      ctx.stroke();

      // progress arc
      const progressAngle = ((seconds - remaining) / seconds) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI/2, -Math.PI/2 + progressAngle, false);
      ctx.strokeStyle = '#0d6efd';
      ctx.lineWidth = 8;
      ctx.stroke();

      // text
      ctx.fillStyle = '#222';
      ctx.font = `${Math.floor(radius / 1.6)}px "Segoe UI", Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
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

  // expose configure
  window.AutoRefreshConfigure = configure;

})();
