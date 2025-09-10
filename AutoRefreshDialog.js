'use strict';
(function () {
  const DATASOURCES_KEY = 'selectedDatasources';
  const INTERVAL_KEY = 'intervalkey';
  const CONFIGURED_KEY = 'configured';

  let selectedDatasources = [];

  $(document).ready(function () {
    tableau.extensions.initializeDialogAsync().then(function (openPayload) {
      // Pre-fill interval (from payload or settings)
      if (tableau.extensions.settings.get(CONFIGURED_KEY) === "1") {
        $('#interval').val(tableau.extensions.settings.get(INTERVAL_KEY));
      } else {
        $('#interval').val(openPayload || 60);
      }

      // Parse already saved datasources
      selectedDatasources = parseSettingsForActiveDataSources();

      const dashboard = tableau.extensions.dashboardContent.dashboard;
      let visibleDatasources = [];

      // Build datasource list UI
      dashboard.worksheets.forEach(function (worksheet) {
        worksheet.getDataSourcesAsync().then(function (datasources) {
          datasources.forEach(function (datasource) {
            let isActive = (selectedDatasources.indexOf(datasource.id) >= 0);
            if (visibleDatasources.indexOf(datasource.id) < 0) {
              addDataSourceItemToUI(datasource, isActive);
              visibleDatasources.push(datasource.id);
            }
          });
        });
      });

      // Save & close
      $('#closeButton').click(closeDialog);
    });
  });

  function parseSettingsForActiveDataSources() {
    let settings = tableau.extensions.settings.getAll();
    if (settings[DATASOURCES_KEY]) {
      return JSON.parse(settings[DATASOURCES_KEY]);
    }
    return [];
  }

  function updateDatasourceList(id) {
    let idIndex = selectedDatasources.indexOf(id);
    if (idIndex < 0) {
      selectedDatasources.push(id);
    } else {
      selectedDatasources.splice(idIndex, 1);
    }
  }

  function addDataSourceItemToUI(datasource, isActive) {
    let containerDiv = $('<div />');
    $('<input />', {
      type: 'checkbox',
      id: datasource.id,
      value: datasource.name,
      checked: isActive,
      click: function () { updateDatasourceList(datasource.id); }
    }).appendTo(containerDiv);

    $('<label />', {
      'for': datasource.id,
      text: datasource.name,
    }).appendTo(containerDiv);

    $('#datasources').append(containerDiv);
  }

  function closeDialog() {
    tableau.extensions.settings.set(DATASOURCES_KEY, JSON.stringify(selectedDatasources));
    tableau.extensions.settings.set(INTERVAL_KEY, $('#interval').val());
    tableau.extensions.settings.set(CONFIGURED_KEY, "1");

    tableau.extensions.settings.saveAsync().then(() => {
      tableau.extensions.ui.closeDialog($('#interval').val()); // pass interval back to AutoRefresh.js
    });
  }
})();
