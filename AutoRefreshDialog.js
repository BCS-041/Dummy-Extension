'use strict';

(function () {
    let refreshIntervalId = null;
    let activeDatasourceIds = [];

    $(document).ready(function () {
        // Initialize Tableau Extension
        tableau.extensions.initializeAsync({ configure: openConfigureDialog })
            .then(() => {
                loadSettings();
                // Listen for settings changes
                tableau.extensions.settings.addEventListener(
                    tableau.TableauEventType.SettingsChanged,
                    loadSettings
                );

                // Bind buttons
                $('#startRefreshBtn').click(startRefresh);
                $('#stopRefreshBtn').click(stopRefresh);
            })
            .catch(err => console.error('Initialization error:', err));
    });

    // Open the configuration dialog
    function openConfigureDialog() {
        const popupUrl = `${window.location.origin}/configure.html`;
        const popupOptions = { width: 500, height: 400 };

        tableau.extensions.ui.displayDialogAsync(popupUrl, '', popupOptions)
            .then(() => loadSettings())
            .catch(err => console.error('Dialog closed or error:', err));
    }

    // Load settings from Tableau
    function loadSettings() {
        const settings = tableau.extensions.settings.getAll();
        activeDatasourceIds = settings.activeDatasourceIds ? JSON.parse(settings.activeDatasourceIds) : [];
        const intervalSec = settings.refreshInterval ? parseInt(settings.refreshInterval, 10) : 60;

        $('#intervalInput').val(intervalSec);

        const list = $('#datasourceList').empty();
        if (activeDatasourceIds.length > 0) {
            activeDatasourceIds.forEach(id => list.append(`<li>${id}</li>`));
        } else {
            list.append('<li>No datasources configured</li>');
        }
    }

    // Start auto-refresh
    function startRefresh() {
        if (refreshIntervalId) clearInterval(refreshIntervalId);

        if (activeDatasourceIds.length === 0) {
            alert('No datasources selected for auto-refresh.');
            return;
        }

        const refreshIntervalSec = parseInt($('#intervalInput').val(), 10);
        if (isNaN(refreshIntervalSec) || refreshIntervalSec < 1) {
            alert('Please enter a valid interval (1 second or more).');
            return;
        }

        refreshIntervalId = setInterval(() => {
            activeDatasourceIds.forEach(id => {
                tableau.extensions.dashboardContent.dashboard.getDataSourceAsync(id)
                    .then(ds => ds.refreshAsync())
                    .catch(err => console.error('Refresh failed for datasource', id, err));
            });
        }, refreshIntervalSec * 1000);

        console.log(`Auto-refresh started: every ${refreshIntervalSec} seconds`);
    }

    // Stop auto-refresh
    function stopRefresh() {
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
            refreshIntervalId = null;
            console.log('Auto-refresh stopped.');
        }
    }
})();
