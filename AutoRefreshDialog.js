'use strict';

(function () {
    const DEFAULT_INTERVAL_MIN = 15;
    let refreshIntervalId = null;
    let activeDatasourceIds = [];
    let refreshIntervalMin = DEFAULT_INTERVAL_MIN;

    $(document).ready(function () {
        tableau.extensions.initializeAsync({ configure: configure }).then(() => {
            loadSettings();

            tableau.extensions.settings.addEventListener(
                tableau.TableauEventType.SettingsChanged,
                loadSettings
            );

            $('#startRefreshBtn').click(startRefresh);
            $('#stopRefreshBtn').click(stopRefresh);
        }).catch(err => console.error('Initialization error:', err));
    });

    // Opens configuration dialog
    function configure() {
        const popupUrl = `${window.location.origin}/configure.html`;
        tableau.extensions.ui.displayDialogAsync(popupUrl, '', { width: 500, height: 400 })
            .then(() => loadSettings())
            .catch(err => console.error('Dialog closed or error:', err));
    }

    // Load settings from Tableau
    function loadSettings() {
        const settings = tableau.extensions.settings.getAll();
        refreshIntervalMin = parseInt(settings.refreshInterval || DEFAULT_INTERVAL_MIN, 10);
        activeDatasourceIds = settings.activeDatasourceIds ? JSON.parse(settings.activeDatasourceIds) : [];

        $('#intervalInput').val(refreshIntervalMin);
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

        refreshIntervalId = setInterval(() => {
            activeDatasourceIds.forEach(id => {
                tableau.extensions.dashboardContent.dashboard.getDataSourceAsync(id)
                    .then(ds => ds.refreshAsync())
                    .catch(err => console.error('Refresh failed for datasource', id, err));
            });
        }, refreshIntervalMin * 60 * 1000);

        console.log(`Auto-refresh started: every ${refreshIntervalMin} minutes`);
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
