'use strict';
(function () {
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  let activeDatasourceIdList = [];
  let uniqueDataSources = [];
  let countdownAnim = null;
  let refreshTimeout = null;
  let currentIntervalSec = 30; // ✅ default 30 seconds

  const canvas = document.getElementById('timerCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  $(document).ready(function () {
    tableau.extensions.initializeAsync({ configure }).then(() => {
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        (event) => {
          console.log("Settings changed → applying new settings");
          applySettingsAndStart(event.newSettings);
        }
      );

      const configured = tableau.extensions.settings.get(KEY_CONFIGURED);
      if (configured === '1') {
        console.log("Extension already configured → restoring settings");
        applySettingsAndStart(tableau.extensions.settings.getAll());
      } else {
        console.log("Extension not yet configured → opening dialog");
        configure();
      }
    }).catch(err => {
      console.error('Initialize error', err);
      alert("Initialize error: " + JSON.stringify(err));
    });
  });

  function configure() {
    const popupUrl = "https://bcs-041.github.io/Dummy-Extension/AutoRefreshDialog.html";

    console.log("Configure clicked, opening dialog at:", popupUrl);
    alert("Configure clicked → Opening dialog:\n" + popupUrl);

    tableau.extensions.ui.displayDialogAsync(popupUrl, null, { height: 400, width: 400 })
      .then((closePayload) => {
        console.log("Dialog closed, payload:", closePayload);
        alert("Dialog closed → Settings saved.");
        applySettingsAndStart(tableau.extensions.settings.getAll());
      })
      .catch((err) => {
        if (err && err.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          console.log("Dialog closed by user (cancelled).");
          alert("Dialog closed by user (cancelled).");
        } else {
          console.error("Dialog error", err);
          alert("Dialog error: " + JSON.stringify(err));
        }
      });
  }

  function applySettingsAndStart(settings) {
    stopAllTimers();

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

    console.log("Applying settings:", settings);
    alert("Applying settings. Interval = " + currentIntervalSec + " sec");

    collectUniqueDataSources().then(() => {
      triggerRefreshCycle();
    }).catch(err => {
      console.error('Error collecting datasources', err);
      alert("Error collecting datasources: " + JSON.stringify(err));
    });
  }

  function collectUniqueDataSources() {
    return new Promise((resolve, reject) => {
      try {
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        const uniqueIds = new Set();
        uniqueDataSources = [];

        const promises = dashboard.worksheets.map(ws => {
          return ws.getDataSourcesAsync().then(dsList => {
            dsList.forEach(ds => {
              if (activeDatasourceIdList.length === 0 || activeDatasourceIdList.indexOf(ds.id) >= 0) {
                if (!uniqueIds.has(ds.id)) {
                  uniqueIds.add(ds.id);
                  uniqueDataSources.push(ds);
                }
              }
            });
          });
        });

        Promise.all(promises).then(() => {
          console.log("Collected datasources:", uniqueDataSources.map(d => d.name));
          resolve();
        }).catch(reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  function triggerRefreshCycle() {
    if (!uniqueDataSources || uniqueDataSources.length === 0) {
      console.warn("No datasources to refresh");
      startCircularTimer(currentIntervalSec, triggerRefreshCycle);
      return;
    }

    console.log("Refreshing datasources...");
    const refreshPromises = uniqueDataSources.map(ds => {
      try {
        return ds.refreshAsync().then(() => {
          console.log(`Refresh queued: ${ds.name}`);
          return { success: true, ds };
        }).catch(err => ({ success: false, ds, err }));
      } catch (e) {
        return Promise.resolve({ success: false, ds, err: e });
      }
    });

    Promise.all(refreshPromises).then(results => {
      results.forEach(r => {
        if (!r.success) console.warn(`Refresh failed: ${r.ds && r.ds.name}`, r.err);
      });
      startCircularTimer(currentIntervalSec, triggerRefreshCycle);
    }).catch(err => {
      console.error("Error in refresh cycle", err);
      startCircularTimer(currentIntervalSec, triggerRefreshCycle);
    });
  }

  function stopAllTimers() {
    if (countdownAnim) {
      cancelAnimationFrame(countdownAnim);
      countdownAnim = null;
    }
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

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

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e6e9ee';
      ctx.lineWidth = 8;
      ctx.stroke();

      const progressAngle = ((seconds - remaining) / seconds) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI/2, -Math.PI/2 + progressAngle, false);
      ctx.strokeStyle = '#0d6efd';
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.fillStyle = '#222';
      ctx.font = `${Math.floor(radius / 1.6)}px "Segoe UI", Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatTime(remaining), cx, cy);

      if (remaining > 0) {
        countdownAnim = requestAnimationFrame(drawFrame);
      } else {
        countdownAnim = null;
        setTimeout(() => {
          try { if (typeof onComplete === 'function') onComplete(); } catch(e) {}
        }, 150);
      }
    }

    if (countdownAnim) cancelAnimationFrame(countdownAnim);
    drawFrame();
  }

  window.AutoRefreshConfigure = configure;
})();
