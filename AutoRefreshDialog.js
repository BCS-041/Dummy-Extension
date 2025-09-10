'use strict';
(function () {
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  window.addEventListener('load', () => {
    tableau.extensions.initializeDialogAsync().then(() => {
      const settings = tableau.extensions.settings.getAll();
      const intervalInput = document.getElementById('intervalInput');
      intervalInput.value = settings[KEY_INTERVAL_SEC] || 30;

      const savedDS = settings[KEY_SELECTED_DS] ? JSON.parse(settings[KEY_SELECTED_DS]) : [];
      const dsListElement = document.getElementById('datasourcesList');
      const seen = new Set();

      Promise.all(tableau.extensions.dashboardContent.dashboard.worksheets.map(ws => ws.getDataSourcesAsync()))
        .then(allLists => {
          allLists.flat().forEach(ds => {
            if (!seen.has(ds.id)) {
              seen.add(ds.id);
              const checked = savedDS.includes(ds.id) ? 'checked' : '';
              const item = document.createElement('div');
              item.className = 'ds-item';
              item.innerHTML = `
                <input type="checkbox" class="ds-checkbox" value="${escapeHtml(ds.id)}" id="ds_${escapeHtml(ds.id)}" ${checked}>
                <label for="ds_${escapeHtml(ds.id)}">${escapeHtml(ds.name)}</label>
              `;
              dsListElement.appendChild(item);
            }
          });
        });

      document.getElementById('saveBtn').addEventListener('click', () => {
        const seconds = parseInt(intervalInput.value, 10);
        if (isNaN(seconds) || seconds < 5) {
          alert("Enter a valid interval (>= 5)");
          return;
        }

        const selected = Array.from(document.querySelectorAll('.ds-checkbox:checked')).map(cb => cb.value);

        tableau.extensions.settings.set(KEY_INTERVAL_SEC, seconds.toString());
        tableau.extensions.settings.set(KEY_SELECTED_DS, JSON.stringify(selected));
        tableau.extensions.settings.set(KEY_CONFIGURED, '1');

        tableau.extensions.settings.saveAsync().then(() => {
          tableau.extensions.ui.closeDialog("saved");
        });
      });

      document.getElementById('cancelBtn').addEventListener('click', () => {
        tableau.extensions.ui.closeDialog("cancelled");
      });
    });
  });

  function escapeHtml(text) {
    return text ? text.replace(/[&<>\"'`=\/]/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;', '/': '&#x2F;'
    })[s]) : '';
  }
})();
