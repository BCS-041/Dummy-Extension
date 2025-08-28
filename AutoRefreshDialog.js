'use strict';
(function () {
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_CONFIGURED = 'configured';

  $(document).ready(function () {
    tableau.extensions.initializeDialogAsync().then(function () {
      alert("✅ Dialog initialized");

      // Load saved settings if any
      const settings = tableau.extensions.settings.getAll();
      if (settings[KEY_INTERVAL_SEC]) {
        const sec = parseInt(settings[KEY_INTERVAL_SEC], 10);
        if (!isNaN(sec)) {
          $('#intervalInput').val(sec); // show saved value
          alert("Loaded saved interval: " + sec + " sec");
        }
      } else {
        $('#intervalInput').val(30); // default
        alert("No saved interval → default 30 sec");
      }

      // Save button
      $('#saveBtn').on('click', function () {
        const seconds = parseInt($('#intervalInput').val(), 10);
        if (isNaN(seconds) || seconds < 1) {
          alert("Enter a valid number ≥ 1 second");
          return;
        }

        // Save settings
        tableau.extensions.settings.set(KEY_INTERVAL_SEC, seconds.toString());
        tableau.extensions.settings.set(KEY_CONFIGURED, '1');

        tableau.extensions.settings.saveAsync().then(() => {
          alert("✅ Settings saved → closing dialog (" + seconds + " sec)");
          tableau.extensions.ui.closeDialog(seconds);
        }).catch(err => {
          alert("❌ Save failed: " + JSON.stringify(err));
        });
      });

      // Cancel button
      $('#cancelBtn').on('click', function () {
        alert("Dialog canceled");
        tableau.extensions.ui.closeDialog('');
      });

    }).catch(err => {
      alert("❌ Dialog init error: " + JSON.stringify(err));
    });
  });
})();
