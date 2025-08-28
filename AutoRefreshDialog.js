'use strict';
(function () {
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  $(document).ready(function () {
    console.log("Dialog loading...");
    alert("Dialog loading...");

    tableau.extensions.initializeDialogAsync().then(function (openPayload) {
      console.log("Dialog initialized, payload:", openPayload);
      alert("Dialog initialized.");

      const settings = tableau.extensions.settings.getAll();

      // Load existing seconds value or default 30
      if (settings[KEY_INTERVAL_SEC]) {
        const sec = parseInt(settings[KEY_INTERVAL_SEC], 10);
        if (!isNaN(sec)) $('#intervalInput').val(sec);
      } else if (openPayload && !isNaN(parseInt(openPayload,10))) {
        $('#intervalInput').val(openPayload);
      } else {
        $('#intervalInput').val(30); // ✅ default 30 sec
      }

      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const seen = new Set();
      const savedDS = settings[KEY_SELECTED_DS] ? JSON.parse(settings[KEY_SELECTED_DS]) : [];

      const promises = dashboard.worksheets.map(ws => ws.getDataSourcesAsync());
      Promise.all(promises).then(allLists => {
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

        if (seen.size === 0) {
          $('#datasourceContainer').append('<div class="ds-item">No datasources found.</div>');
        }
      }).catch(err => {
        console.error("Error fetching datasources", err);
        alert("Error fetching datasources: " + JSON.stringify(err));
      });

    }).catch(err => {
      console.error("Dialog init error", err);
      alert("Dialog init error: " + JSON.stringify(err));
    });

    // Save
    $('#saveBtn').on('click', function () {
      console.log("Save button clicked");
      alert("Save button clicked");

      const seconds = parseInt($('#intervalInput').val(), 10);
      if (isNaN(seconds) || seconds < 1) {
        alert("Enter a valid interval (>=1 second)");
        return;
      }

      const selected = [];
      $('.ds-checkbox:checked').each(function () {
        selected.push($(this).val());
      });

      tableau.extensions.settings.set(KEY_INTERVAL_SEC, seconds.toString());
      tableau.extensions.settings.set(KEY_SELECTED_DS, JSON.stringify(selected));
      tableau.extensions.settings.set(KEY_CONFIGURED, '1');

      tableau.extensions.settings.saveAsync().then(() => {
        console.log("Settings saved, closing dialog");
        alert("Settings saved → Closing dialog.");
        tableau.extensions.ui.closeDialog(seconds);
      }).catch(err => {
        console.error("Settings save failed", err);
        alert("Settings save failed: " + JSON.stringify(err));
      });
    });

    // Cancel
    $('#cancelBtn').on('click', function () {
      console.log("Cancel clicked");
      alert("Cancel clicked → Closing dialog");
      tableau.extensions.ui.closeDialog('');
    });

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
