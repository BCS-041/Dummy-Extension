'use strict';
(function () {
  const defaultIntervalInSec = 15; // default 15 seconds
  let intervalSec = defaultIntervalInSec;
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
          updateExtensionBasedOnSettings(settingsEvent.newSettings);
        }
      );

      if (tableau.extensions.settings.get("configured") != 1) {
        $("#inactive").show();
        $("#active").hide();
      }
    });

    // 🔹 Bind configure button click
    $("#configureButton").on("click", function () {
      configure();
    });
  });

  function getSettings() {
    let currentSettings = tableau.extensions.settings.getAll();

    if (currentSettings.selectedDatasources) {
      activeDatasourceIdList = JSON.parse(currentSettings.selectedDatasources);
    }
    if (currentSettings.intervalkey) {
      intervalSec = parseInt(currentSettings.intervalkey, 10);
    }

    if (currentSettings.selectedDatasources) {
      $("#inactive").hide();
      $("#active").show();
      setupRefreshInterval(intervalSec);
    }
  }

  function configure() {
    const popupUrl = `${window.location.origin}/Dummy-Extension/AutoRefreshDialog.html`;

    tableau.extensions.ui
      .displayDialogAsync(popupUrl, defaultIntervalInSec.toString(), {
        height: 500,
        width: 500,
      })
      .then((closePayload) => {
        $("#inactive").hide();
        $("#active").show();
        setupRefreshInterval(parseInt(closePayload, 10));
      })
      .catch((error) => {
        if (error.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          console.log("Dialog was closed by user");
        } else {
          console.error(error.message);
        }
      });
  }

  function setupRefreshInterval(seconds) {
    if (refreshInterval) {
      clearTimeout(refreshInterval);
    }

    function collectUniqueDataSources() {
      let dashboard = tableau.extensions.dashboardContent.dashboard;
      let uniqueDataSourceIds = new Set();
      uniqueDataSources = [];

      let dataSourcePromises = dashboard.worksheets.map((worksheet) =>
        worksheet.getDataSourcesAsync().then((datasources) => {
          datasources.forEach((ds) => {
            if (!uniqueDataSourceIds.has(ds.id) && activeDatasourceIdList.includes(ds.id)) {
              uniqueDataSourceIds.add(ds.id);
              uniqueDataSources.push(ds);
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
      const refreshPromises = uniqueDataSources.map((ds) => ds.refreshAsync());
      Promise.all(refreshPromises).then(() => {
        startTextTimer(seconds, refreshDataSources);
      });
    }

    collectUniqueDataSources().then(() => {
      refreshDataSources();
    });
  }

  // 🔹 Simple Text Timer
  function startTextTimer(seconds, onComplete) {
    let remaining = seconds;
    const timerDisplay = document.getElementById("timerDisplay");

    function tick() {
      timerDisplay.textContent = remaining;
      if (remaining > 0) {
        remaining--;
        countdownTimer = setTimeout(tick, 1000);
      } else {
        if (onComplete) onComplete();
      }
    }

    tick();
  }

  function updateExtensionBasedOnSettings(settings) {
    if (settings.selectedDatasources) {
      activeDatasourceIdList = JSON.parse(settings.selectedDatasources);
    }
  }
})();
