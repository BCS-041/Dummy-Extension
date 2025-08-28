'use strict';
(function () {
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  $(document).ready(function () {
    // initialize dialog
    tableau.extensions.initializeDialogAsync().then(function (openPayload) {
      // openPayload could be default value (not relied upon here)
      const settings = tableau.extensions.settings.getAll();

      // set interval input: prefer saved value, otherwise default 15 minutes
      if (settings[KEY_INTERVAL_SEC]) {
        const sec = parseInt(settings[KEY_INTERVAL_SEC], 10);
        if (!isNaN(sec)) $('#intervalInput').val(Math.max(1, Math.round(sec / 60)));
      } else if (openPayload && !isNaN(parseInt(openPayload,10))) {
        // if caller passed payload minutes
        $('#intervalInput').val(openPayload);
      } else {
        $('#intervalInput').val(15); // default minutes
      }

      // populate datasources list dynamically (unique across worksheets)
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const seen = new Set();
      const savedDS = settings[KEY_SELECTED_DS] ? JSON.parse(settings[KEY_SELECTED_DS]) : [];

      // collect datasource objects from all worksheets
      const promises = dashboard.worksheets.map(ws => ws.getDataSourcesAsync());
      Promise.all(promises).then(allLists => {
        // flatten and unique by id
        allLists.flat().forEach(ds => {
          if (!seen.has(ds.id)) {
            seen.add(ds.id);
            const checked = savedDS.includes(ds.id) ? 'checked' : '';
            const safeName = escapeHtml(ds.name);
            $('#datasourceContainer').append(`
              <div class="ds-item">
                <label>
                  <input type="checkbox" class="ds-checkbox" value="${ds.id}" ${checked}> ${safeName}
                </label>
              </div>
            `);
          }
        });

        // if no datasources found (rare), show message
        if (seen.size === 0) {
          $('#datasourceContainer').append('<div class="ds-item">No datasources found in this dashboard.</div>');
        }
      }).catch(err => {
        console.error('Error fetching datasources', err);
        $('#datasourceContainer').append('<div class="ds-item">Error loading datasources</div>');
      });

    }).catch(err => {
      console.error('Dialog init error', err);
    });

    // Save button
    $('#saveBtn').on('click', function () {
      const minutes = parseInt($('#intervalInput').val(), 10);
      if (isNaN(minutes) || minutes < 1) {
        alert('Enter a valid interval (minutes, >= 1).');
        return;
      }
      const intervalSeconds = Math.round(minutes * 60);

      // gather selected datasource ids (if any)
      const selected = [];
      $('.ds-checkbox:checked').each(function () {
        selected.push($(this).val());
      });

      // save into Tableau settings
      tableau.extensions.settings.set(KEY_INTERVAL_SEC, intervalSeconds.toString());
      tableau.extensions.settings.set(KEY_SELECTED_DS, JSON.stringify(selected));
      tableau.extensions.settings.set(KEY_CONFIGURED, '1');

      tableau.extensions.settings.saveAsync().then(() => {
        // close and return interval (seconds) if caller wants it
        tableau.extensions.ui.closeDialog(intervalSeconds);
      }).catch(err => {
        console.error('Settings save failed', err);
        alert('Failed to save settings. See console for details.');
      });
    });

    // Cancel button
    $('#cancelBtn').on('click', function () {
      tableau.extensions.ui.closeDialog('');
    });

    // small utility
    function escapeHtml(text) {
      if (!text) return '';
      return text.replace(/[&<>"'`=\/]/g, function (s) {
        return ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;',
          '"': '&quot;', "'": '&#39;', '/': '&#x2F;',
          '`': '&#x60;', '=': '&#x3D;'
        })[s];
      });
    }
  });
})();
