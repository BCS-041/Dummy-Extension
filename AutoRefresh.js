'use strict';
(function () {
  const DEFAULT_INTERVAL = 15; // minutes
  let refreshTimer = null;
  let activeDatasourceIdList = [];
  let uniqueDataSources = [];

  $(document).ready(function () {
    tableau.extensions.initializeAsync({ configure }).then(() => {
      // Load settings
      getSettings();

      // React to settings changes
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        (event) => updateExtensionBasedOnSettings(event.newSettings)
      );

      // First time → open configuration
      if (tableau.extensions.settings.get("configured") !== "1") {
        configure();
      }
    });
  });

  // ------------------- SETTINGS -------------------
  function getSettings() {
    const settings = tableau.extensions.settings.getAll();

    if (settings.selectedDatasources) {
      activeDatasourceIdList = JSON.parse(settings.selectedDatasources);
    }

    const intervalMin = settings.intervalkey ? parseInt(settings.intervalkey, 10) : DEFAULT_INTERVAL;

    if (settings.selectedDatasources) {
      $('#inactive').hide();
      $('#active').show();

      $('#interval').text(intervalMin);
      $('#datasourceCount').text(activeDatasourceIdList.length);

      setupRefreshInterval(intervalMin);
    }
  }

  function configure() {
    const popupUrl = `${window.location.origin}/AutoRefreshDialog.html`;

    tableau.extensions.ui.displayDialogAsync(popupUrl, DEFAULT_INTERVAL, { height: 500, width: 500 })
      .then((closePayload) => {
        // Show active state
        $('#inactive').hide();
        $('#active').show();

        const intervalMin = parseInt(closePayload, 10) || DEFAULT_INTERVAL;
        $('#interval').text(intervalMin);
        setupRefreshInterval(intervalMin);
      })
      .catch((error) => {
        if (error.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          console.log("Dialog was closed by user");
        } else {
          console.error(error.message);
        }
      });
  }

  // ------------------- REFRESH CYCLE -------------------
  function setupRefreshInterval(intervalMin) {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    const intervalSec = intervalMin * 60;

    function updateNextRefreshTime() {
      const nextRefresh = new Date(Date.now() + intervalSec * 1000);
      $('#nextrefresh').text(nextRefresh.toLocaleTimeString());
    }

    function collectUniqueDataSources() {
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const uniqueIds = new Set();
      uniqueDataSources = [];

      const promises = dashboard.worksheets.map(ws =>
        ws.getDataSourcesAsync().then(datasources => {
          datasources.forEach(ds => {
            if (!uniqueIds.has(ds.id) && activeDatasourceIdList.includes(ds.id)) {
              uniqueIds.add(ds.id);
              uniqueDataSources.push(ds);
            }
          });
        })
      );

      return Promise.all(promises);
    }

    function refreshDataSources() {
      if (refreshTimer) clearTimeout(refreshTimer);

      const refreshPromises = uniqueDataSources.map(ds => ds.refreshAsync());
      Promise.all(refreshPromises)
        .then(() => {
          updateNextRefreshTime();
          refreshTimer = setTimeout(refreshDataSources, intervalSec * 1000);
        })
        .catch(err => console.error("❌ Refresh failed", err));
    }

    collectUniqueDataSources().then(() => {
      $('#uniqueCount').text(uniqueDataSources.length);
      refreshDataSources();
      updateNextRefreshTime();
    });
  }

  // ------------------- REACT TO SETTINGS -------------------
  function updateExtensionBasedOnSettings(settings) {
    if (settings.selectedDatasources) {
      activeDatasourceIdList = JSON.parse(settings.selectedDatasources);
      $('#datasourceCount').text(activeDatasourceIdList.length);
    }
  }
})();
