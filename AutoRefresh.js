'use strict';
(function () {
  const KEY_CONFIGURED = 'configured';
  const KEY_INTERVAL_SEC = 'intervalSeconds';
  const KEY_SELECTED_DS = 'selectedDatasources';

  let activeDatasourceIdList = [];
  let uniqueDataSources = [];
  let countdownAnim = null;
  let refreshTimeout = null;
  let currentIntervalSec = 30; // Default 30 seconds

  let startTime = Date.now();
  let refreshIntervalStart = Date.now();

  const canvas = document.getElementById('timerCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const dpr = window.devicePixelRatio || 1;
  if (canvas) {
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
  }

  window.addEventListener('load', () => {
    tableau.extensions.initializeAsync({ configure }).then(() => {
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        (event) => {
          console.log("Settings changed → applying new settings");
          applySettingsAndStart(event.newSettings);
        }
      );

      const configured = tableau.extensions.settings.get(KEY_CONFIGURED);
      if (configured === '1') {
        console.log("Extension already configured → restoring settings");
        applySettingsAndStart(tableau.extensions.settings.getAll());
      } else {
        console.log("Extension not yet configured → opening dialog");
        configure();
      }
    }).catch(err => {
      console.error('Initialize error', err);
    });
  });

  function configure() {
    const popupUrl = "AutoRefreshDialog.html";
    console.log("Configure clicked, opening dialog");

    tableau.extensions.ui.displayDialogAsync(popupUrl, '', { height: 500, width: 400 }).then((closePayload) => {
      if (closePayload) {
        console.log("Dialog closed with payload:", closePayload);
      }
    }).catch(err => {
      console.error("Dialog error", err);
    });
  }

  function applySettingsAndStart(newSettings) {
    const interval = parseInt(newSettings[KEY_INTERVAL_SEC], 10);
    const selectedDS = newSettings[KEY_SELECTED_DS] ? JSON.parse(newSettings[KEY_SELECTED_DS]) : [];
    
    stopRefresh();

    if (!isNaN(interval) && interval > 0) {
      currentIntervalSec = interval;
      console.log("New interval set to", currentIntervalSec, "seconds");

      startTime = Date.now();
      refreshIntervalStart = Date.now();
      
      startRefreshTimeout(currentIntervalSec);
      
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const promises = dashboard.worksheets.map(ws => ws.getDataSourcesAsync());
      
      Promise.all(promises).then(allLists => {
        const datasources = allLists.flat();
        uniqueDataSources = [...new Set(datasources.map(ds => ds.id))];
        
        if (selectedDS.length > 0) {
          activeDatasourceIdList = datasources.filter(ds => selectedDS.includes(ds.id)).map(ds => ds.id);
        } else {
          activeDatasourceIdList = datasources.map(ds => ds.id);
        }
        
        console.log("Datasources to refresh:", activeDatasourceIdList);
      }).catch(err => {
        console.error("Datasource fetch error", err);
      });
      
    } else {
      console.warn("Invalid interval received from settings.");
    }
  }

  function startRefreshTimeout(interval) {
    console.log("Starting refresh timeout for", interval, "seconds");
    
    drawFrame();

    refreshTimeout = setTimeout(() => {
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const promises = activeDatasourceIdList.map(dsId => {
        return dashboard.getDataSourceByIdAsync(dsId).then(dataSource => {
          return dataSource.refreshAsync();
        }).catch(err => {
          console.error("Refresh failed for datasource", dsId, err);
        });
      });

      Promise.all(promises).then(() => {
        console.log("All datasources refreshed. Starting next timeout.");
        refreshIntervalStart = Date.now();
        startRefreshTimeout(currentIntervalSec);
      }).catch(err => {
        console.error("Error during batch refresh", err);
      });
    }, interval * 1000);
  }

  function stopRefresh() {
    console.log("Stopping refresh timers and animations.");
    clearTimeout(refreshTimeout);
    cancelAnimationFrame(countdownAnim);
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function drawFrame() {
    if (!ctx) return;
    const now = Date.now();
    
    const totalElapsedSeconds = Math.floor((now - startTime) / 1000);
    const refreshElapsed = Math.floor((now - refreshIntervalStart) / 1000);
    const remaining = Math.max(currentIntervalSec - refreshElapsed, 0);

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    // Draw background bar
    const barHeight = 16;
    const barY = h / 2 - barHeight / 2;
    ctx.fillStyle = '#e6e9ee';
    ctx.fillRect(0, barY, w, barHeight);

    // Draw progress bar
    const progressWidth = (w * (currentIntervalSec - remaining)) / currentIntervalSec;
    ctx.fillStyle = '#0d6efd';
    ctx.fillRect(0, barY, progressWidth, barHeight);

    // Draw timer text
    ctx.fillStyle = '#222';
    ctx.font = `bold 24px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${remaining}s`, w / 2, barY - 10);

    // Draw total elapsed time
    ctx.fillStyle = '#666';
    ctx.font = `12px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Total time: ${formatTime(totalElapsedSeconds)}`, w / 2, barY + barHeight + 10);

    countdownAnim = requestAnimationFrame(drawFrame);
  }
})();
