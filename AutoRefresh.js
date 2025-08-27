'use strict';
(function () {
  const defaultIntervalInMin = '15';
  let interval2 = '15'
  let refreshInterval;
  let activeDatasourceIdList = [];
  let uniqueDataSources = [];
  let countdownTimer;

  $(document).ready(function () {
    tableau.extensions.initializeAsync({ 'configure': configure }).then(function () {
      getSettings();
      tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, (settingsEvent) => {
        updateExtensionBasedOnSettings(settingsEvent.newSettings)
      });
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

    tableau.extensions.ui.displayDialogAsync(popupUrl, defaultIntervalInMin, { height: 500, width: 500 }).then((closePayload) => {
      $('#inactive').hide();
      $('#active').show();
      setupRefreshInterval(closePayload);
    }).catch((error) => {
      switch (error.errorCode) {
        case tableau.ErrorCodes.DialogClosedByUser:
          console.log("Dialog was closed by user");
          break;
        default:
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
        startCircularTimer(interval, refreshDataSources);
      });
    }

    collectUniqueDataSources().then(() => {
      refreshDataSources();
    });
  }

  // 🔹 Circular Timer Renderer
  function startCircularTimer(seconds, onComplete) {
    const canvas = document.getElementById("timerCanvas");
    if (!canvas) return; // safety check
    const ctx = canvas.getContext("2d");
    let start = Date.now();

    function draw() {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(seconds - elapsed, 0);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Circle background
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 5, 0, 2 * Math.PI);
      ctx.strokeStyle = "#ddd";
      ctx.lineWidth = 8;
      ctx.stroke();

      // Progress arc
      const progress = (remaining / seconds) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 5, -Math.PI / 2, -Math.PI / 2 + progress, false);
      ctx.strokeStyle = "#007bff"; // professional blue
      ctx.lineWidth = 8;
      ctx.stroke();

      // Timer text
      ctx.fillStyle = "#333";
      ctx.font = `${canvas.width / 4}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(remaining, canvas.width / 2, canvas.height / 2);

      if (remaining > 0) {
        countdownTimer = requestAnimationFrame(draw);
      } else {
        if (onComplete) onComplete();
      }
    }

    draw();
  }

  function updateExtensionBasedOnSettings(settings) {
    if (settings.selectedDatasources) {
      activeDatasourceIdList = JSON.parse(settings.selectedDatasources);
    }
  }
})();
