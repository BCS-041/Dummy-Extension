'use strict';

(function() {
    const DEFAULT_INTERVAL_SECONDS = 60;
    const SETTINGS_KEY_DATASOURCES = 'selectedDatasources';
    const SETTINGS_KEY_INTERVAL = 'intervalkey';
    const SETTINGS_KEY_CONFIGURED = 'configured';

    let countdownTimer = null;
    let refreshInProgress = false;
    let endTime = null;
    let activeDatasourceIdList = [];
    let uniqueDataSources = [];

    $(document).ready(function() {
        tableau.extensions.initializeAsync({ configure }).then(() => {
            loadSettings();

            tableau.extensions.settings.addEventListener(
                tableau.TableauEventType.SettingsChanged,
                (event) => updateFromSettings(event.newSettings)
            );

            if (tableau.extensions.settings.get(SETTINGS_KEY_CONFIGURED) !== "1") {
                configure();
            }
        });
    });

    // Load saved settings and start countdown/refresh
    function loadSettings() {
        const settings = tableau.extensions.settings.getAll();

        if (settings[SETTINGS_KEY_DATASOURCES]) {
            activeDatasourceIdList = JSON.parse(settings[SETTINGS_KEY_DATASOURCES]);
        }

        const interval = settings[SETTINGS_KEY_INTERVAL] ? parseInt(settings[SETTINGS_KEY_INTERVAL], 10) : DEFAULT_INTERVAL_SECONDS;

        if (activeDatasourceIdList.length > 0) {
            $('#inactive').hide();
            $('#active').show();
            setupRefreshLogic(interval);
        }
    }

    // Open configuration dialog
    function configure() {
        const popupUrl = `${window.location.origin}/AutoRefreshDialog.html`;
        const currentInterval = tableau.extensions.settings.get(SETTINGS_KEY_INTERVAL) || DEFAULT_INTERVAL_SECONDS;

        tableau.extensions.ui.displayDialogAsync(popupUrl, currentInterval.toString(), { height: 500, width: 500 })
            .then((newInterval) => {
                $('#inactive').hide();
                $('#active').show();
                setupRefreshLogic(parseInt(newInterval, 10));
            })
            .catch((error) => {
                if (error.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
                    console.error("Dialog error:", error.message);
                }
            });
    }

    // Main refresh logic
    function setupRefreshLogic(intervalSeconds) {
        refreshInProgress = false;
        clearInterval(countdownTimer);

        // Collect datasources once
        async function collectUniqueDataSources() {
            const dashboard = tableau.extensions.dashboardContent.dashboard;
            const seen = new Set();
            uniqueDataSources = [];

            const wsPromises = dashboard.worksheets.map(ws => ws.getDataSourcesAsync());
            const dsArrays = await Promise.all(wsPromises);

            dsArrays.forEach(dsList => {
                dsList.forEach(ds => {
                    if (!seen.has(ds.id) && activeDatasourceIdList.includes(ds.id)) {
                        seen.add(ds.id);
                        uniqueDataSources.push(ds);
                    }
                });
            });

            if (uniqueDataSources.length === 0) {
                console.warn("No datasources selected.");
            }
        }

        function updateCountdownUI() {
            const timeLeft = Math.round((endTime - Date.now()) / 1000);
            if (typeof window.updateUI === "function") window.updateUI(timeLeft);
        }

        function startCountdown() {
            endTime = Date.now() + intervalSeconds * 1000;

            countdownTimer = setInterval(() => {
                const timeLeft = Math.round((endTime - Date.now()) / 1000);
                updateCountdownUI();

                if (timeLeft <= 0 && !refreshInProgress) {
                    executeRefresh();
                }
            }, 1000);
        }

        async function executeRefresh() {
            if (refreshInProgress || uniqueDataSources.length === 0) return;

            refreshInProgress = true;

            try {
                // Refresh all datasources simultaneously
                await Promise.all(uniqueDataSources.map(ds => ds.refreshAsync()));
                console.log("All datasources refreshed simultaneously.");

                if (typeof window.triggerPulse === "function") window.triggerPulse();
            } catch (err) {
                console.error("Refresh failed:", err);
            } finally {
                refreshInProgress = false;
                endTime = Date.now() + intervalSeconds * 1000; // restart countdown
            }
        }

        // Initialize
        collectUniqueDataSources().then(() => startCountdown());
    }

    // Handle settings changes
    function updateFromSettings(settings) {
        if (settings[SETTINGS_KEY_DATASOURCES]) {
            activeDatasourceIdList = JSON.parse(settings[SETTINGS_KEY_DATASOURCES]);
        }

        const interval = settings[SETTINGS_KEY_INTERVAL] ? parseInt(settings[SETTINGS_KEY_INTERVAL], 10) : DEFAULT_INTERVAL_SECONDS;

        if (activeDatasourceIdList.length > 0) {
            $('#inactive').hide();
            $('#active').show();
            setupRefreshLogic(interval);
        } else {
            if (countdownTimer) clearInterval(countdownTimer);
            $('#active').hide();
            $('#inactive').show();
        }
    }

})();
