/**
 * PISA Educational Inequality Explorer - Main Application
 * Author: Kevin Schoenholzer
 * Date: 2025-12-15
 */

// Import modules
import { getState, setState, setLoading, getCurrentOutcome, setCurrentOutcome,
         getCurrentPredictor, setCurrentPredictor, setAnalysisType } from './core/state-manager.js';
import { loadMetadata, loadSelectedData, getCacheStats } from './core/data-loader.js';
import { initLoadingIndicator, updateProgress, showDataStatus, hideLoading,
         showButtonSpinner, hideButtonSpinner, resetProgress } from './ui/loading-indicator.js';
import { initSelectors, populateFromMetadata } from './ui/country-selector.js';

// Application initialization
async function initApp() {
    console.log('==================================================');
    console.log('PISA Educational Inequality Data Explorer');
    console.log('Initializing...');
    console.log('==================================================');

    try {
        // Initialize UI components
        initLoadingIndicator();
        initSelectors();
        initTabSystem();
        initAdvancedOptions();
        initEventListeners();

        // Load metadata
        showDataStatus('Loading metadata...', 'info');
        const metadata = await loadMetadata();

        console.log('Metadata loaded:', metadata);

        // Populate UI from metadata
        populateFromMetadata(metadata);

        // Update status
        showDataStatus(
            `Ready to analyze PISA data from ${metadata.countries.length} countries
             (${metadata.years_available.join(', ')}). Select countries and years, then click "Load Selected Data".`,
            'info'
        );

        console.log('✓ Application initialized successfully');

    } catch (error) {
        console.error('Failed to initialize app:', error);
        showDataStatus(
            `Failed to load metadata: ${error.message}. Please check that data files are generated.`,
            'error'
        );

        alert(`Application initialization failed:\n\n${error.message}\n\nPlease ensure you have run the R scripts to generate data files.`);
    }
}

/**
 * Initialize tab system
 */
function initTabSystem() {
    const tabButtons = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            button.classList.add('active');

            const targetContent = document.getElementById(tabName);
            if (targetContent) {
                targetContent.classList.add('active');

                // Trigger any tab-specific initialization if needed
                onTabSwitch(tabName);
            }
        });
    });

    console.log('Tab system initialized');
}

/**
 * Handle tab switching
 * @param {String} tabName - Name of activated tab
 */
function onTabSwitch(tabName) {
    const state = getState();

    // Only run analyses if data is loaded
    if (!state.mergedData || state.mergedData.length === 0) {
        console.log(`Tab switched to ${tabName}, but no data loaded yet`);
        return;
    }

    console.log(`Switched to tab: ${tabName}`);

    // Run tab-specific logic
    // TODO: In Phase 3, call appropriate visualization functions here
    // Example:
    // if (tabName === 'overview') renderOverview();
    // if (tabName === 'regression') renderRegression();
}

/**
 * Initialize advanced options toggle
 */
function initAdvancedOptions() {
    const header = document.getElementById('advanced-options-header');
    const content = document.getElementById('advanced-options-content');

    if (header && content) {
        header.addEventListener('click', () => {
            header.classList.toggle('expanded');
            content.classList.toggle('expanded');
        });
    }

    console.log('Advanced options initialized');
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
    // Load data button
    const loadDataBtn = document.getElementById('load-data-btn');
    if (loadDataBtn) {
        loadDataBtn.addEventListener('click', handleLoadData);
    }

    // Outcome variable selector
    const outcomeSelect = document.getElementById('outcome');
    if (outcomeSelect) {
        outcomeSelect.addEventListener('change', (e) => {
            setCurrentOutcome(e.target.value);
            console.log('Outcome changed to:', e.target.value);

            // Re-run analyses if data is loaded
            const state = getState();
            if (state.mergedData && state.mergedData.length > 0) {
                // TODO: Phase 3 - trigger re-analysis
                console.log('Outcome changed - would re-run analyses');
            }
        });
    }

    // Predictor variable selector
    const predictorSelect = document.getElementById('predictor');
    if (predictorSelect) {
        predictorSelect.addEventListener('change', (e) => {
            setCurrentPredictor(e.target.value);
            console.log('Predictor changed to:', e.target.value);

            // Re-run analyses if data is loaded
            const state = getState();
            if (state.mergedData && state.mergedData.length > 0) {
                // TODO: Phase 3 - trigger re-analysis
                console.log('Predictor changed - would re-run analyses');
            }
        });
    }

    // Analysis type radio buttons
    const analysisTypeRadios = document.querySelectorAll('input[name="analysis-type"]');
    analysisTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            setAnalysisType(e.target.value);
            console.log('Analysis type changed to:', e.target.value);
        });
    });

    console.log('Event listeners initialized');
}

/**
 * Handle load data button click
 */
async function handleLoadData() {
    const state = getState();

    // Validate selections
    if (state.selectedCountries.length === 0) {
        alert('Please select at least one country.');
        return;
    }

    if (state.selectedYears.length === 0) {
        alert('Please select at least one year.');
        return;
    }

    const loadDataBtn = document.getElementById('load-data-btn');

    try {
        console.log('===========================================');
        console.log('Loading data...');
        console.log('Countries:', state.selectedCountries);
        console.log('Years:', state.selectedYears);
        console.log('===========================================');

        // Show loading UI
        showButtonSpinner(loadDataBtn);
        resetProgress();
        setLoading(true);

        // Update status
        const totalChunks = state.selectedCountries.length * state.selectedYears.length;
        showDataStatus(
            `Loading ${totalChunks} data chunks (${state.selectedCountries.length} countries × ${state.selectedYears.length} years)...`,
            'info'
        );

        // Load data with progress tracking
        const data = await loadSelectedData((progress) => {
            updateProgress(progress);
        });

        // Store merged data in state
        setState({ mergedData: data });

        // Get cache stats
        const stats = getCacheStats();

        console.log('===========================================');
        console.log('Data loading complete!');
        console.log('Total students:', data.length.toLocaleString());
        console.log('Countries:', stats.countries.join(', '));
        console.log('Years:', stats.years.join(', '));
        console.log('===========================================');

        // Update status
        showDataStatus(
            `✓ Loaded ${data.length.toLocaleString()} student records from ${stats.chunksLoaded} data chunks.
             Ready to analyze! Switch to different tabs to explore the data.`,
            'success'
        );

        // Run initial analyses
        // TODO: Phase 3 - Run descriptive statistics and populate overview tab
        runInitialAnalyses(data);

    } catch (error) {
        console.error('Error loading data:', error);

        showDataStatus(
            `Failed to load data: ${error.message}`,
            'error'
        );

        alert(`Failed to load data:\n\n${error.message}\n\nPlease check:\n1. R scripts have been run\n2. Data files exist in pisa/data/country-year/\n3. Browser console for details`);

    } finally {
        setLoading(false);
        hideButtonSpinner(loadDataBtn);
        hideLoading();
    }
}

/**
 * Run initial analyses on loaded data
 * @param {Array} data - Merged student data
 */
function runInitialAnalyses(data) {
    console.log('Running initial analyses...');

    // TODO: Phase 3 - Implement actual analysis
    // For now, just log basic info

    // Get unique countries and years
    const countries = [...new Set(data.map(d => d.country))];
    const years = [...new Set(data.map(d => d.year))];

    console.log('Data summary:');
    console.log('- Students:', data.length);
    console.log('- Countries:', countries.length, '-', countries.join(', '));
    console.log('- Years:', years.length, '-', years.join(', '));

    // Check for required variables
    const sampleRecord = data[0];
    console.log('Sample record fields:', Object.keys(sampleRecord));

    // TODO: Phase 3 tasks:
    // 1. Calculate descriptive statistics (mean, SD, Gini)
    // 2. Calculate SES gradient
    // 3. Update overview stat cards
    // 4. Render overview chart
    // 5. Store results in state

    console.log('✓ Initial analyses complete (placeholder)');
}

/**
 * Get current outcome field name based on selection
 * @returns {String} Field name in data
 */
function getOutcomeFieldName() {
    const outcome = getCurrentOutcome();
    const map = {
        'math': 'math',
        'reading': 'reading',
        'science': 'science'
    };
    return map[outcome] || 'math';
}

/**
 * Get current predictor field name based on selection
 * @returns {String} Field name in data
 */
function getPredictorFieldName() {
    const predictor = getCurrentPredictor();
    const map = {
        'escs': 'escs',
        'parent_edu': 'mother_educ' // or father_educ, or composite
    };
    return map[predictor] || 'escs';
}

/**
 * Get selected control variables
 * @returns {Array} Array of control variable names
 */
function getSelectedControls() {
    const controls = [];

    if (document.getElementById('ctrl-gender')?.checked) {
        controls.push('gender');
    }

    if (document.getElementById('ctrl-parent-edu')?.checked) {
        controls.push('parent_edu');
    }

    if (document.getElementById('ctrl-year')?.checked) {
        controls.push('year');
    }

    return controls;
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM already loaded
    initApp();
}

// Make app available globally for debugging (development only)
if (typeof window !== 'undefined') {
    window.PISAApp = {
        getState,
        getCacheStats,
        handleLoadData,
        runInitialAnalyses
    };
}

console.log('App module loaded');
