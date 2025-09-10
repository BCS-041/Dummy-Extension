'use strict';
(function () {
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  let activeDatasourceIdList = [];
  let uniqueDataSources = [];
  let timerInterval = null;
  let refreshInterval = 30;
  let endTime = null;

  const countdownEl = document.getElementById("countdown");
  const controls = document.getElementById("controls");
  const intervalInput = document.getElementById("interval");
  const startBtn = document.getElementById("startBtn");

  // ---------------- Timer Functions ----------------
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
        triggerRefreshCycle(); // refresh Tableau
      } else {
        countdownEl.textContent = formatTime(remaining);
      }
    }, 1000);

    controls.style.display = "none"; 
    countdownEl.textContent = formatTime(refreshInterval);
    resizeCountdown();
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resizeCountdown() {
    const circle = document.querySelector('.circle');
    if (!circle || !countdownEl) return;
    const circleWidth = circle.offsetWidth;
    countdownEl.style.fontSize = (circleWidth / 5) + 'px';
  }

  window.addEventListener('resize', resizeCountdown);
  window.addEventListener('load', resizeCountdown);

  // ---------------- Tableau Integration ----------------
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
        configure(); // open dialog first time
      }
    }).catch(err => {
      console.error('Initialize error', err);
    });
  });

  function configure() {
    const popupUrl = "AutoRefreshDialog.html";
    tableau.extensions.ui.displayDialogAsync(popupUrl, null, { height: 500, width: 420 })
      .then(() => {
        // Dialog closed after saving
        applySettingsAndStart(tableau.extensions.settings.getAll());
      })
      .catch(err => {
        if (err && err.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          console.warn("Dialog closed by user without saving.");
        } else {
          console.error("Dialog error", err);
        }
      });
  }

  function applySettingsAndStart(settings) {
    stopTimer();

    // Load selected datasources
    if (settings[KEY_SELECTED_DS]) {
      try {
        activeDatasourceIdList = JSON.parse(settings[KEY_SELECTED_DS]);
        if (!Array.isArray(activeDatasourceIdList)) activeDatasourceIdList = [];
      } catch {
        activeDatasourceIdList = [];
      }
    }

    // Load interval
    if (settings[KEY_INTERVAL_SEC]) {
      const v = parseInt(settings[KEY_INTERVAL_SEC], 10);
      if (!isNaN(v) && v > 0) refreshInterval = v;
    }

    collectUniqueDataSources().then(() => {
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

        Promise.all(promises).then(() => {
          console.log("✅ Collected datasources:", uniqueDataSources.map(d => d.name));
          resolve();
        }).catch(reject);
      } catch (e) {
        reject(e);
      }
    });
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

  // Manual start from UI
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      let val = parseInt(intervalInput.value, 10);
      if (!isNaN(val) && val > 0) refreshInterval = val;
      startTimer();
    });
  }

  window.AutoRefreshConfigure = configure;
})();
