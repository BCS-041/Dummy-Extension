'use strict';
(function () {
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  window.addEventListener('load', () => {
    tableau.extensions.initializeDialogAsync().then(() => {
      const settings = tableau.extensions.settings.getAll();

      // Set interval input
      const intervalInput = document.getElementById('intervalInput');
      intervalInput.value = settings[KEY_INTERVAL_SEC] || 30;

      // Populate datasources
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const seen = new Set();
      const savedDS = settings[KEY_SELECTED_DS] ? JSON.parse(settings[KEY_SELECTED_DS]) : [];
      const dsListElement = document.getElementById('datasourcesList');

      Promise.all(dashboard.worksheets.map(ws => ws.getDataSourcesAsync()))
        .then(allLists => {
          const datasources = allLists.flat();
          datasources.forEach(ds => {
            if (!seen.has(ds.id)) {
              seen.add(ds.id);
              const checked = savedDS.includes(ds.id) ? 'checked' : '';
              const dsItem = document.createElement('div');
              dsItem.className = 'ds-item';
              dsItem.innerHTML = `
                <input type="checkbox" class="ds-checkbox" value="${escapeHtml(ds.id)}" id="ds_${escapeHtml(ds.id)}" ${checked}>
                <label for="ds_${escapeHtml(ds.id)}">${escapeHtml(ds.name)}</label>
              `;
              dsListElement.appendChild(dsItem);
            }
          });
        }).catch(err => {
          console.error("Datasource population failed:", err);
        });

      // Save button
      document.getElementById('saveBtn').addEventListener('click', () => {
        const seconds = parseInt(intervalInput.value, 10);
        if (isNaN(seconds) || seconds < 5) {
          alert("Enter a valid interval (>=5 seconds)");
          return;
        }

        const selected = Array.from(document.querySelectorAll('.ds-checkbox:checked')).map(cb => cb.value);

        tableau.extensions.settings.set(KEY_INTERVAL_SEC, seconds.toString());
        tableau.extensions.settings.set(KEY_SELECTED_DS, JSON.stringify(selected));
        tableau.extensions.settings.set(KEY_CONFIGURED, '1');

        tableau.extensions.settings.saveAsync().then(() => {
          tableau.extensions.ui.closeDialog();
        }).catch(err => {
          console.error("Settings save failed", err);
        });
      });

      // Cancel button
      document.getElementById('cancelBtn').addEventListener('click', () => {
        tableau.extensions.ui.closeDialog();
      });
    }).catch(err => {
      console.error('Dialog initialization failed:', err);
    });
  });

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>\"'`=\/]/g, function (s) {
      return ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;', '/': '&#x2F;'
      })[s];
    });
  }
})();
