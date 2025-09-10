'use strict';

$(document).ready(function () {
    // Initialize Tableau Extension
    tableau.extensions.initializeAsync()
        .then(() => {
            loadDatasources();
            loadCurrentSettings();

            // Bind Save button
            $('#saveBtn').click(saveSettings);
        })
        .catch(err => console.error('Initialization error:', err));
});

// Load all datasources from the dashboard
function loadDatasources() {
    tableau.extensions.dashboardContent.dashboard.getDataSourcesAsync()
        .then(datasources => {
            const select = $('#datasourceSelect');
            select.empty();
            datasources.forEach(ds => select.append(`<option value="${ds.id}">${ds.name}</option>`));
        })
        .catch(err => console.error('Error fetching datasources:', err));
}

// Load previously saved settings
function loadCurrentSettings() {
    const settings = tableau.extensions.settings.getAll();
    const savedIds = settings.activeDatasourceIds ? JSON.parse(settings.activeDatasourceIds) : [];
    const intervalSec = settings.refreshInterval ? parseInt(settings.refreshInterval, 10) : 60;

    $('#intervalInput').val(intervalSec);

    $('#datasourceSelect option').each(function () {
        if (savedIds.includes($(this).val())) {
            $(this).prop('selected', true);
        }
    });
}

// Save settings to Tableau
function saveSettings() {
    const selectedIds = $('#datasourceSelect').val() || [];
    const intervalSec = parseInt($('#intervalInput').val(), 10);

    if (selectedIds.length === 0) {
        alert('Please select at least one datasource.');
        return;
    }

    if (isNaN(intervalSec) || intervalSec < 1) {
        alert('Please enter a valid refresh interval (1 second or more).');
        return;
    }

    tableau.extensions.settings.set('activeDatasourceIds', JSON.stringify(selectedIds));
    tableau.extensions.settings.set('refreshInterval', intervalSec);

    tableau.extensions.settings.saveAsync()
        .then(() => tableau.extensions.ui.closeDialog('Settings saved!'))
        .catch(err => console.error('Save settings error:', err));
}
