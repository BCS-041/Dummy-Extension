'use strict';

(function () {
  const KEY_INTERVAL = 'refreshInterval';
  const KEY_DATASOURCES = 'selectedDatasources';

  tableau.extensions.initializeDialogAsync().then(() => {
    loadDatasources();
    loadCurrentSettings();
    document.getElementById('saveBtn').addEventListener('click', saveSettings);
  });

  function loadDatasources() {
    tableau.extensions.dashboardContent.dashboard.getDataSourcesAsync()
      .then(datasources => {
        const select = document.getElementById('datasourceSelect');
        select.innerHTML = '';
        datasources.forEach(ds => {
          const option = document.createElement('option');
          option.value = ds.id;
          option.textContent = ds.name;
          select.appendChild(option);
        });
      })
      .catch(err => {
        console.error('Error fetching datasources:', err);
      });
  }

  function loadCurrentSettings() {
    const settings = tableau.extensions.settings.getAll();
    const savedIds = settings[KEY_DATASOURCES] ? JSON.parse(settings[KEY_DATASOURCES]) : [];
    const intervalSec = settings[KEY_INTERVAL] ? parseInt(settings[KEY_INTERVAL], 10) : 30;

    document.getElementById('intervalInput').value = intervalSec;
    const options = document.querySelectorAll('#datasourceSelect option');
    options.forEach(option => {
      if (savedIds.includes(option.value)) {
        option.selected = true;
      }
    });
  }

  function saveSettings() {
    const selectedOptions = document.querySelectorAll('#datasourceSelect option:checked');
    const selectedIds = Array.from(selectedOptions).map(option => option.value);
    const intervalSec = parseInt(document.getElementById('intervalInput').value, 10);

    if (selectedIds.length === 0) {
      alert('Please select at least one data source.');
      return;
    }

    if (isNaN(intervalSec) || intervalSec < 5) {
      alert('Please enter a valid refresh interval (at least 5 seconds).');
      return;
    }

    tableau.extensions.settings.set(KEY_DATASOURCES, JSON.stringify(selectedIds));
    tableau.extensions.settings.set(KEY_INTERVAL, intervalSec);
    
    tableau.extensions.settings.saveAsync().then(() => {
      tableau.extensions.ui.closeDialog('Success');
    }).catch(err => {
      console.error('Error saving settings:', err);
    });
  }
})();
