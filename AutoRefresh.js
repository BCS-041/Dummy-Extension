'use strict';
(function () {
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  let refreshInterval = 30;
  let activeDatasourceIdList = [];
  let uniqueDataSources = [];
  let timerInterval = null;
  let endTime = null;

  const countdownEl = document.getElementById("countdown");

  // Format MM:SS
  function formatTime(seconds) {
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // Start countdown
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

    countdownEl.textContent = formatTime(refreshInterval);
    resizeCountdown();
  }

  // Resize countdown text
  function resizeCountdown() {
    const circle = document.querySelector('.circle');
    if (!circle || !countdownEl) return;
    const circleWidth = circle.offsetWidth;
    countdownEl.style.fontSize = (circleWidth / 5) + 'px';
  }
  window.addEventListener('resize', resizeCountdown);
  window.addEventListener('load', resizeCountdown);

  // Refresh Tableau datasources
  function triggerRefreshCycle() {
    if (!uniqueDataSources.length) {
      console.warn("⚠️ No datasources to refresh.");
      startTimer();
      return;
    }

    console.log("🔄 Refreshing:", uniqueDataSources.map(ds => ds.name));
    Promise.all(uniqueDataSources.map(ds =>
      ds.refreshAsync()
        .then(() => console.log(`✅ Refreshed ${ds.name}`))
        .catch(err => console.error(`❌ Failed ${ds.name}`, err))
    )).finally(() => startTimer());
  }

  // Collect datasources
  function collectUniqueDataSources() {
    return tableau.extensions.dashboardContent.dashboard.worksheets
      .map(ws => ws.getDataSourcesAsync())
      .reduce((chain, p) => chain.then(list => p.then(x => list.concat(x))), Promise.resolve([]))
      .then(all => {
        const seen = new Set();
        uniqueDataSources = [];
        all.forEach(ds => {
          if (!seen.has(ds.id) &&
            (activeDatasourceIdList.length === 0 || activeDatasourceIdList.includes(ds.id))) {
            seen.add(ds.id);
            uniqueDataSources.push(ds);
          }
        });
      });
  }

  // Apply settings → start timer
  function applySettings(settings) {
    activeDatasourceIdList = [];
    refreshInterval = 30;

    if (settings[KEY_INTERVAL_SEC]) {
      let v = parseInt(settings[KEY_INTERVAL_SEC], 10);
      if (!isNaN(v) && v > 0) refreshInterval = v;
    }
    if (settings[KEY_SELECTED_DS]) {
      try {
        activeDatasourceIdList = JSON.parse(settings[KEY_SELECTED_DS]);
      } catch {}
    }

    collectUniqueDataSources().then(startTimer);
  }

  // Open settings dialog
  function configure() {
    tableau.extensions.ui.displayDialogAsync("AutoRefreshDialog.html", null, { width: 400, height: 500 })
      .then(() => {
        // After dialog closes with Save
        applySettings(tableau.extensions.settings.getAll());
      })
      .catch(err => {
        if (err.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          console.warn("Dialog closed without saving.");
        } else {
          console.error(err);
        }
      });
  }

  // Extension init
  $(document).ready(() => {
    tableau.extensions.initializeAsync({ configure }).then(() => {
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        e => applySettings(e.newSettings)
      );

      if (tableau.extensions.settings.get(KEY_CONFIGURED) === '1') {
        applySettings(tableau.extensions.settings.getAll());
      } else {
        configure();
      }
    });
  });
})();
