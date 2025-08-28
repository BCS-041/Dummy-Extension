'use strict';
(function () {
  // SETTINGS KEYS
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  // runtime
  let activeDatasourceIdList = []; // array of datasource ids (strings)
  let uniqueDataSources = [];      // actual datasource objects
  let countdownAnim = null;        // requestAnimationFrame id
  let refreshTimeout = null;       // timeout between refresh cycles
  let currentIntervalSec = 60 * 15; // default 15 minutes

  // Canvas
  const canvas = document.getElementById('timerCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  // Initialize extension
  $(document).ready(function () {
    tableau.extensions.initializeAsync({ configure }).then(() => {
      // Listen for settings changes (Configure button usage)
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        (event) => {
          // Re-read all settings and re-start based on new settings
          applySettingsAndStart(event.newSettings);
        }
      );

      // On load, check whether configured and either restore or open dialog
      const configured = tableau.extensions.settings.get(KEY_CONFIGURED);
      if (configured === '1') {
        // restore settings from tableau and start
        applySettingsAndStart(tableau.extensions.settings.getAll());
      } else {
        // show configure dialog first time
        configure();
      }
    }).catch(err => {
      console.error('Initialize error', err);
    });
  });

  // Open the dialog (also bound to configure menu by initializeAsync)
  function configure() {
    // 🔹 Use absolute GitHub Pages path to your dialog
    const popupUrl = "https://bcs-041.github.io/Dummy-Extension/AutoRefreshDialog.html";

    tableau.extensions.ui.displayDialogAsync(popupUrl, null, { height: 400, width: 400 })
      .then((closePayload) => {
        // closePayload contains the interval in seconds (we set it in dialog)
        // After dialog closed and settings saved, start based on settings
        applySettingsAndStart(tableau.extensions.settings.getAll());
      })
      .catch((err) => {
        if (err && err.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          // user closed dialog; if not configured yet, do nothing
          console.log('Dialog closed by user');
        } else {
          console.error('Dialog error', err);
        }
      });
  }

  // Apply settings object and start refresh/timer
  function applySettingsAndStart(settings) {
    // Stop any existing timers/animations
    stopAllTimers();

    // Read saved settings
    if (settings[KEY_SELECTED_DS]) {
      try {
        activeDatasourceIdList = JSON.parse(settings[KEY_SELECTED_DS]);
        if (!Array.isArray(activeDatasourceIdList)) activeDatasourceIdList = [];
      } catch (e) {
        activeDatasourceIdList = [];
      }
    } else {
      activeDatasourceIdList = [];
    }

    if (settings[KEY_INTERVAL_SEC]) {
      const v = parseInt(settings[KEY_INTERVAL_SEC], 10);
      if (!isNaN(v) && v > 0) currentIntervalSec = v;
    }

    // Build uniqueDataSources (from dashboard worksheets)
    collectUniqueDataSources().then(() => {
      // start a refresh cycle immediately
      triggerRefreshCycle();
    }).catch(err => {
      console.error('Error collecting datasources', err);
    });
  }

  // collect datasources from each worksheet; if activeDatasourceIdList empty => include all
  function collectUniqueDataSources() {
    return new Promise((resolve, reject) => {
      try {
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        const uniqueIds = new Set();
        uniqueDataSources = [];

        const promises = dashboard.worksheets.map(ws => {
          return ws.getDataSourcesAsync().then(dsList => {
            dsList.forEach(ds => {
              // include if user selected OR if user selected none (means all)
              if (activeDatasourceIdList.length === 0 || activeDatasourceIdList.indexOf(ds.id) >= 0) {
                if (!uniqueIds.has(ds.id)) {
                  uniqueIds.add(ds.id);
                  uniqueDataSources.push(ds);
                }
              }
            });
          });
        });

        Promise.all(promises).then(() => resolve()).catch(reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  // Trigger refresh for each datasource and then start timer for the next cycle
  function triggerRefreshCycle() {
    if (!uniqueDataSources || uniqueDataSources.length === 0) {
      // nothing to refresh but still show timer — still start timer
      startCircularTimer(currentIntervalSec, triggerRefreshCycle);
      return;
    }

    // call refreshAsync on each datasource
    const refreshPromises = uniqueDataSources.map(ds => {
      try {
        return ds.refreshAsync().then(res => ({ success: true, ds })).catch(err => ({ success: false, ds, err }));
      } catch (e) {
        return Promise.resolve({ success: false, ds, err: e });
      }
    });

    Promise.all(refreshPromises).then(results => {
      // optionally log results to console
      results.forEach(r => {
        if (r.success) console.log(`Refresh queued: ${r.ds.name} (${r.ds.id})`);
        else console.warn(`Refresh failed to queue: ${r.ds && r.ds.name}`, r.err || '');
      });

      // start timer waiting for next cycle
      startCircularTimer(currentIntervalSec, triggerRefreshCycle);
    }).catch(err => {
      console.error('Error refreshing datasources', err);
      // still start timer to retry later
      startCircularTimer(currentIntervalSec, triggerRefreshCycle);
    });
  }

  // stop running timers/animations
  function stopAllTimers() {
    if (countdownAnim) {
      cancelAnimationFrame(countdownAnim);
      countdownAnim = null;
    }
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    // clear canvas
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Circular timer draws and calls onComplete when time up
  function startCircularTimer(seconds, onComplete) {
    if (!ctx) return;
    // Normalize seconds to integer
    seconds = Math.max(1, Math.floor(Number(seconds) || 1));
    const startTime = Date.now();

    // adapt canvas pixel size for crisp rendering
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

      // clear
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 6;

      // background circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e6e9ee';
      ctx.lineWidth = 8;
      ctx.stroke();

      // progress arc (clockwise from top)
      const progressAngle = ((seconds - remaining) / seconds) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI/2, -Math.PI/2 + progressAngle, false);
      ctx.strokeStyle = '#0d6efd';
      ctx.lineWidth = 8;
      ctx.stroke();

      // remaining time text
      ctx.fillStyle = '#222';
      ctx.font = `${Math.floor(radius / 1.6)}px "Segoe UI", Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatTime(remaining), cx, cy);

      // continue or finish
      if (remaining > 0) {
        countdownAnim = requestAnimationFrame(drawFrame);
      } else {
        countdownAnim = null;
        // small delay before calling onComplete to ensure UI updated
        setTimeout(() => {
          try { if (typeof onComplete === 'function') onComplete(); } catch(e) {}
        }, 150);
      }
    }

    // start drawing
    if (countdownAnim) cancelAnimationFrame(countdownAnim);
    drawFrame();
  }

  // expose configure to global if needed (not required but safe)
  window.AutoRefreshConfigure = configure;

})();
