'use strict';
(function () {
  const defaultIntervalInMin = '15';
  let interval2 = '15';
  let refreshInterval;
  let activeDatasourceIdList = [];
  let uniqueDataSources = [];
  let countdownTimer;

  $(document).ready(function () {
    tableau.extensions.initializeAsync({ 'configure': configure }).then(function () {
      getSettings();
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        (settingsEvent) => {
          updateExtensionBasedOnSettings(settingsEvent.newSettings)
        }
      );
      if (tableau.extensions.settings.get("configured") != 1) {
        configure();
      }
    });
  });

  function getSettings() {
    let currentSettings = tableau.extensions.settings.getAll();
    if (currentSettings.selectedDatasources) {
      activeDatasourceIdList = JSON.parse(currentSettings.selectedDatasources);
    }
    if (currentSettings.intervalkey) {
      interval2 = currentSettings.intervalkey;
    }
    if (currentSettings.selectedDatasources) {
      $('#inactive').hide();
      $('#active').show();
      setupRefreshInterval(interval2);
    }
  }

  function configure() {
    const popupUrl = `${window.location.origin}/AutoRefreshDialog.html`;

    tableau.extensions.ui.displayDialogAsync(popupUrl, defaultIntervalInMin, { height: 500, width: 500 })
      .then((closePayload) => {
        $('#inactive').hide();
        $('#active').show();
        setupRefreshInterval(closePayload);
      })
      .catch((error) => {
        if (error.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
          console.error(error.message);
        }
      });
  }

  function setupRefreshInterval(interval) {
    if (refreshInterval) {
      clearTimeout(refreshInterval);
    }

    function collectUniqueDataSources() {
      let dashboard = tableau.extensions.dashboardContent.dashboard;
      let uniqueDataSourceIds = new Set();
      uniqueDataSources = [];
      let dataSourcePromises = dashboard.worksheets.map((worksheet) =>
        worksheet.getDataSourcesAsync().then((datasources) => {
          datasources.forEach((datasource) => {
            if (!uniqueDataSourceIds.has(datasource.id) && activeDatasourceIdList.includes(datasource.id)) {
              uniqueDataSourceIds.add(datasource.id);
              uniqueDataSources.push(datasource);
            }
          });
        })
      );
      return Promise.all(dataSourcePromises);
    }

    function refreshDataSources() {
      if (refreshInterval) {
        clearTimeout(refreshInterval);
      }
      const refreshPromises = uniqueDataSources.map((datasource) => datasource.refreshAsync());
      Promise.all(refreshPromises).then(() => {
        startTextTimer(interval, refreshDataSources);
      });
    }

    collectUniqueDataSources().then(() => {
      refreshDataSources();
    });
  }

  // 🔹 Simple Responsive Timer (text only)
  function startTextTimer(seconds, onComplete) {
    const timerEl = document.getElementById("timerDisplay");
    if (!timerEl) return;

    let start = Date.now();

    function update() {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(seconds - elapsed, 0);

      let displayTime;
      if (seconds >= 60) {
        const minutes = Math.ceil(remaining / 60);
        displayTime = `${minutes} min`;
      } else {
        displayTime = `${remaining}s`;
      }

      // Auto-scale font
      let containerWidth = timerEl.parentElement.offsetWidth;
      timerEl.style.fontSize = Math.max(containerWidth / 6, 20) + "px";
      timerEl.style.fontWeight = "bold";
      timerEl.style.color = "#2c3e50"; // professional dark gray/blue

      timerEl.textContent = displayTime;

      if (remaining > 0) {
        countdownTimer = requestAnimationFrame(update);
      } else {
        if (onComplete) onComplete();
      }
    }

    update();
  }

  function updateExtensionBasedOnSettings(settings) {
    if (settings.selectedDatasources) {
      activeDatasourceIdList = JSON.parse(settings.selectedDatasources);
    }
  }
})();
