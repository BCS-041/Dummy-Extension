'use strict';
(function () {
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  let activeDatasourceIdList = [];
  let uniqueDataSources = [];
  let timerInterval = null;
  let refreshInterval = 30; // default 30s
  let endTime = null;

  const countdownEl = document.getElementById("countdown");
  const controls = document.getElementById("controls");
  const intervalInput = document.getElementById("interval");
  const startBtn = document.getElementById("startBtn");

  // --- TIMER LOGIC ---
  function formatTime(seconds) {
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    endTime = Date.now() + refreshInterval * 1000;

    timerInterval = setInterval(() => {
      let remaining = Math.floor((endTime - Date.now()) / 1000);

      if (remaining <= 0) {
        clearInterval(timerInterval);

        // 🔄 Refresh Tableau datasources
        triggerRefreshCycle();

      } else {
        countdownEl.textContent = formatTime(remaining);
      }
    }, 1000);

    controls.style.display = "none"; // hide manual controls once active
    countdownEl.textContent = formatTime(refreshInterval);
    resizeCountdown();
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function triggerRefreshCycle() {
    if (!uniqueDataSources || uniqueDataSources.length === 0) {
      console.warn("⚠️ No datasources found to refresh.");
      startTimer();
      return;
    }

    console.log("🔄 Refreshing datasources:", uniqueDataSources.map(ds => ds.name));

    const refreshPromises = uniqueDataSources.map(ds =>
      ds.refreshAsync()
        .then(() => console.log(`✅ Refreshed: ${ds.name}`))
        .catch(err => console.error(`❌ Refresh failed: ${ds.name}`, err))
    );

    Promise.all(refreshPromises)
      .then(() => console.log("✨ Refresh cycle complete."))
      .finally(() => startTimer());
  }

  // --- Manual Start ---
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      let val = parseInt(intervalInput.value, 10);
      if (!isNaN(val) && val > 0) refreshInterval = val;
      startTimer();
    });
  }

  // --- Tableau Initialization ---
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
      }
    }).catch(err => {
      console.error('Initialize error', err);
    });
  });

  function configure() {
    const popupUrl = "AutoRefreshDialog.html";
    tableau.extensions.ui.displayDialogAsync(popupUrl, null, { height: 400, width: 400 })
      .then(() => {
        applySettingsAndStart(tableau.extensions.settings.getAll());
      })
      .catch(err => {
        if (err && err.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
          console.error("Dialog error", err);
        }
      });
  }

  function applySettingsAndStart(settings) {
    stopTimer();

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
      if (!isNaN(v) && v > 0) refreshInterval = v;
    }

    collectUniqueDataSources().then(() => {
      if (uniqueDataSources.length === 0) {
        console.error("❌ No datasources collected.");
      } else {
        console.log("✅ Collected datasources:", uniqueDataSources.map(d => d.name));
      }
      startTimer();
    }).catch(err => {
      console.error('Error collecting datasources', err);
    });
  }

  function collectUniqueDataSources() {
    return new Promise((resolve, reject) => {
      try {
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        const uniqueIds = new Set();
        uniqueDataSources = [];

        const promises = dashboard.worksheets.map(ws =>
          ws.getDataSourcesAsync().then(dsList => {
            console.log(`📊 Worksheet [${ws.name}] datasources:`, dsList.map(d => d.name));
            dsList.forEach(ds => {
              if (activeDatasourceIdList.length === 0 || activeDatasourceIdList.includes(ds.id)) {
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

  // --- Auto-resize countdown font ---
  function resizeCountdown() {
    const circle = document.querySelector('.circle');
    const span = document.getElementById('countdown');
    if (!circle || !span) return;
    const circleWidth = circle.offsetWidth;
    span.style.fontSize = (circleWidth / 5) + 'px';
  }

  window.addEventListener('resize', resizeCountdown);
  window.addEventListener('load', resizeCountdown);

  // Expose configure
  window.AutoRefreshConfigure = configure;
})();
