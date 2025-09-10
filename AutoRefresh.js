'use strict';
(function () {
  const defaultIntervalInMin = '15';
  let interval2 = '15'
  let refreshInterval;
  let activeDatasourceIdList = [];
  $(document).ready(function () {
    tableau.extensions.initializeAsync({'configure': configure}).then(function() {     
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
	if (currentSettings.intervalkey){
	  interval2 = currentSettings.intervalkey;
	}
	if (currentSettings.selectedDatasources){
		$('#inactive').hide();
		$('#active').show();
		$('#interval').text(currentSettings.intervalkey);
		$('#datasourceCount').text(activeDatasourceIdList.length);
		setupRefreshInterval(interval2);
	}
  }	  
  function configure() {
    const popupUrl = `${window.location.origin}/AutoRefreshDialog.html`;

    tableau.extensions.ui.displayDialogAsync(popupUrl, defaultIntervalInMin, { height: 500, width: 500 }).then((closePayload) => {

      $('#inactive').hide();
      $('#active').show();

      $('#interval').text(closePayload);
      setupRefreshInterval(closePayload);
    }).catch((error) => {
      switch(error.errorCode) {
        case tableau.ErrorCodes.DialogClosedByUser:
          console.log("Dialog was closed by user");
          break;
        default:
          console.error(error.message);
      }
    });
  }
  let uniqueDataSources = []; 
  function setupRefreshInterval(interval) {
    if (refreshInterval) {
      clearTimeout(refreshInterval);
    }
    function updateNextRefreshTime(interval) {
      const nextRefresh = new Date(Date.now() + interval * 1000);
      const formattedTime = nextRefresh.toLocaleTimeString(); 
      $('#nextrefresh').text(formattedTime); 
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
        updateNextRefreshTime(interval);
        refreshInterval = setTimeout(refreshDataSources, interval * 1000); // Schedule next refresh
      });
    }
    collectUniqueDataSources().then(() => {
      $('#uniqueCount').text(uniqueDataSources.length); 
      refreshDataSources(); 
      updateNextRefreshTime(interval);
    });
  }
  function updateExtensionBasedOnSettings(settings) {
    if (settings.selectedDatasources) {
      activeDatasourceIdList = JSON.parse(settings.selectedDatasources);
      $('#datasourceCount').text(activeDatasourceIdList.length);
    }
  }
})();
