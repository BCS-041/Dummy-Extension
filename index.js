'use strict';

(function () {
  const KEY_INTERVAL = 'refreshInterval';
  const KEY_DATASOURCES = 'selectedDatasources';

  let uniqueDataSources = [];
  let timerInterval = null;
  let refreshInterval = 30; // default to 30s
  let endTime = null;

  const countdownEl = document.getElementById("countdown");
  const configureBtn = document.getElementById("configureBtn");
  const controlsEl = document.getElementById("controls");

  // --- Initialization ---
  tableau.extensions.initializeAsync().then(() => {
    loadSettings();
    tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, (event) => {
      loadSettings();
    });

    configureBtn.addEventListener("click", openConfigureDialog);
  });

  // --- Timer and Refresh Logic ---
  function loadSettings() {
    const settings = tableau.extensions.settings.getAll();
    const selectedIds = settings[KEY_DATASOURCES] ? JSON.parse(settings[KEY_DATASOURCES]) : [];
    refreshInterval = settings[KEY_INTERVAL] ? parseInt(settings[KEY_INTERVAL], 10) : 30;

    if (selectedIds.length > 0) {
      collectUniqueDataSources(selectedIds)
        .then(() => {
          controlsEl.style.display = 'none';
          startTimer();
        })
        .catch(err => {
          console.error('Error collecting datasources', err);
        });
    } else {
      controlsEl.style.display = 'block';
      countdownEl.textContent = '00:00';
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    }
  }

  function startTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    endTime = Date.now() + refreshInterval * 1000;

    timerInterval = setInterval(() => {
      let remaining = Math.floor((endTime - Date.now()) / 1000);

      if (remaining <= 0) {
        clearInterval(timerInterval);
        triggerRefreshCycle();
      } else {
        countdownEl.textContent = formatTime(remaining);
      }
    }, 1000);
    
    countdownEl.textContent = formatTime(refreshInterval);
  }

  function triggerRefreshCycle() {
    console.log(`Refreshing ${uniqueDataSources.length} datasources...`);
    
    const refreshPromises = uniqueDataSources.map(ds => {
      console.log(`Refreshing ${ds.name}...`);
      return ds.refreshAsync().catch(err => {
        console.error(`Refresh failed for datasource ${ds.name}:`, err);
      });
    });

    Promise.all(refreshPromises)
      .then(() => {
        console.log('All datasources refreshed. Restarting timer.');
        startTimer();
      })
      .catch(err => {
        console.error('Error during refresh cycle:', err);
      });
  }

  function collectUniqueDataSources(selectedIds) {
    return new Promise((resolve, reject) => {
      try {
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        uniqueDataSources = [];

        dashboard.worksheets.forEach(ws => {
          ws.getDataSourcesAsync().then(dsList => {
            dsList.forEach(ds => {
              if (selectedIds.includes(ds.id) && !uniqueDataSources.some(d => d.id === ds.id)) {
                uniqueDataSources.push(ds);
              }
            });
          });
        });
        
        // Use a slight delay to ensure all async calls are completed before resolving
        setTimeout(() => resolve(), 500); 
      } catch (e) {
        reject(e);
      }
    });
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // --- Configuration Dialog ---
  function openConfigureDialog() {
    const popupUrl = `${window.location.origin}/configure.html`;
    const popupOptions = { width: 500, height: 400 };

    tableau.extensions.ui.displayDialogAsync(popupUrl, '', popupOptions)
      .then(() => {
        // Dialog closed. Settings will be reloaded via event listener.
      })
      .catch(err => {
        console.error('Dialog closed or error:', err);
      });
  }
})();