'use strict';
(function () {
  const DATASOURCES_KEY = 'selectedDatasources';
  const INTERVAL_KEY = 'intervalkey';
  const CONFIGURED_KEY = 'configured';

  let activeDatasourceIdList = [];
  let uniqueDataSources = [];
  let refreshInterval = 30; // default in seconds
  let timerInterval = null;
  let endTime = null;

  const countdownEl = document.getElementById("countdown");
  const controls = document.getElementById("controls");
  const intervalInput = document.getElementById("interval");
  const startBtn = document.getElementById("startBtn");

  // ------------------ Timer ------------------
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
        triggerRefreshCycle();
      } else {
        countdownEl.textContent = formatTime(remaining);
      }
    }, 1000);

    controls.style.display = "none";
    countdownEl.textContent = formatTime(refreshInterval);
    resizeCountdown();
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function resizeCountdown() {
    const circle = document.querySelector('.circle');
    if (!circle || !countdownEl) return;
    countdownEl.style.fontSize = (circle.offsetWidth / 5) + 'px';
  }
  window.addEventListener('resize', resizeCountdown);
  window.addEventListener('load', resizeCountdown);

  // ------------------ Datasource Refresh ------------------
  function triggerRefreshCycle() {
    if (!uniqueDataSources.length) {
      console.warn("⚠️ No datasources found to refresh.");
      startTimer();
      return;
    }

    console.log("🔄 Refreshing:", uniqueDataSources.map(ds => ds.name));
    Promise.all(uniqueDataSources.map(ds => ds.refreshAsync()))
      .then(() => console.log("✅ Refresh complete"))
      .finally(() => startTimer());
  }

  function collectUniqueDataSources() {
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    const seen = new Set();
    uniqueDataSources = [];

    const promises = dashboard.worksheets.map(ws =>
      ws.getDataSourcesAsync().then(list => {
        list.forEach(ds => {
          if (!seen.has(ds.id) &&
             (activeDatasourceIdList.length === 0 || activeDatasourceIdList.includes(ds.id))) {
            seen.add(ds.id);
            uniqueDataSources.push(ds);
          }
        });
      })
    );

    return Promise.all(promises);
  }

  // ------------------ Apply Settings ------------------
  function applySettings(settings) {
    stopTimer();
    activeDatasourceIdList = [];
    refreshInterval = 30;

    if (settings[INTERVAL_KEY]) {
      let v = parseInt(settings[INTERVAL_KEY], 10);
      if (!isNaN(v) && v > 0) refreshInterval = v;
    }
    if (settings[DATASOURCES_KEY]) {
      try {
        activeDatasourceIdList = JSON.parse(settings[DATASOURCES_KEY]);
      } catch {}
    }

    collectUniqueDataSources().then(startTimer);
  }

  // ------------------ Configure Dialog ------------------
  function configure() {
    const popupUrl = "AutoRefreshDialog.html";
    tableau.extensions.ui.displayDialogAsync(popupUrl, refreshInterval, { width: 500, height: 500 })
      .then((closePayload) => {
        console.log("Dialog closed with:", closePayload);
        applySettings(tableau.extensions.settings.getAll());
      })
      .catch(err => {
        if (err.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          console.warn("Dialog closed by user without saving");
        } else {
          console.error("Dialog error", err);
        }
      });
  }

  // ------------------ Init ------------------
  $(document).ready(() => {
    tableau.extensions.initializeAsync({ configure }).then(() => {
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        e => applySettings(e.newSettings)
      );

      if (tableau.extensions.settings.get(CONFIGURED_KEY) === "1") {
        applySettings(tableau.extensions.settings.getAll());
      } else {
        configure();
      }
    });
  });

  // ------------------ Start button ------------------
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      let val = parseInt(intervalInput.value, 10);
      if (!isNaN(val) && val > 0) {
        refreshInterval = val;
      }
      applySettings(tableau.extensions.settings.getAll());
    });
  }

  window.AutoRefreshConfigure = configure;
})();
