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

// Import analysis modules
import { calculateDescriptiveStats, calculateInequalityMeasures, calculateSESGradient,
         calculateStatsByGroup } from './analysis/descriptive.js';
import { runPooledOLS, runFixedEffects, runRandomEffects } from './analysis/regression.js';
import { decomposeAchievementGap, calculateVarianceDecomposition } from './analysis/decomposition.js';
import { hausmanTest } from './analysis/diagnostics.js';

// Import visualization modules
import { updateOverviewStats, renderOverviewChart } from './visualization/overview-viz.js';
import { renderAllDistributionCharts } from './visualization/distribution-viz.js';
import {
    renderRegressionComparison,
    renderCoefficientPlot,
    renderHausmanTest,
    renderRegressionScatterPlots,
    renderResidualPlot,
    renderQQPlot
} from './visualization/regression-viz.js';
import { renderAllComparativeCharts } from './visualization/comparative-viz.js';

// Import export modules
import { exportComprehensiveSummary, exportDescriptiveStats, exportAllRegressionModels } from './export/csv-export.js';
import { exportCurrentDataset } from './export/data-export.js';
import { exportAllAnalysisCharts } from './export/figure-export.js';
import { generateFullReport } from './export/report-export.js';

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
 * Show loading cursor during calculations
 */
function startCalculating() {
    document.body.classList.add('calculating');
}

/**
 * Hide loading cursor after calculations
 */
function stopCalculating() {
    document.body.classList.remove('calculating');
}

/**
 * Wrap async function with loading indicator
 * @param {Function} fn - Async function to execute
 * @returns {Function} Wrapped function
 */
function withLoading(fn) {
    return async function(...args) {
        startCalculating();
        try {
            return await fn(...args);
        } finally {
            // Small delay to ensure UI updates
            setTimeout(() => stopCalculating(), 100);
        }
    };
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

    const data = state.mergedData;
    const outcomeVar = getCurrentOutcome();
    const predictorVar = getCurrentPredictor();
    const weightType = getWeightType();

    // Run tab-specific visualizations with loading indicator
    startCalculating();

    // Use setTimeout to ensure cursor updates before heavy computation
    setTimeout(() => {
        try {
            switch (tabName) {
                case 'overview':
                    updateOverviewStats(data, outcomeVar, predictorVar, weightType);
                    renderOverviewChart(data, outcomeVar, predictorVar, weightType);
                    break;

                case 'distribution':
                    renderAllDistributionCharts(data, outcomeVar);
                    break;

                case 'gap-decomposition':
                    renderGapDecomposition(data, outcomeVar, predictorVar, weightType);
                    break;

                case 'regression':
                    runRegressionAnalyses(data, outcomeVar, predictorVar, weightType);
                    break;

                case 'comparative':
                    const comparativeResults = state.analysisResults?.comparative;
                    if (comparativeResults) {
                        renderAllComparativeCharts(data, comparativeResults, outcomeVar);
                    }
                    break;

                case 'diagnostics':
                    renderDiagnostics(data, outcomeVar);
                    break;

                default:
                    console.log(`No specific rendering for tab: ${tabName}`);
            }
        } catch (error) {
            console.error(`Error rendering ${tabName} tab:`, error);
        } finally {
            stopCalculating();
        }
    }, 50);
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
                console.log('Outcome changed - re-running analyses');
                runInitialAnalyses(state.mergedData);
                // Re-render current tab
                const activeTab = document.querySelector('.tab.active');
                if (activeTab) {
                    onTabSwitch(activeTab.getAttribute('data-tab'));
                }
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
                console.log('Predictor changed - re-running analyses');
                runInitialAnalyses(state.mergedData);
                // Re-render current tab
                const activeTab = document.querySelector('.tab.active');
                if (activeTab) {
                    onTabSwitch(activeTab.getAttribute('data-tab'));
                }
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

    // Export buttons
    const exportSummaryBtn = document.getElementById('export-summary-btn');
    if (exportSummaryBtn) {
        exportSummaryBtn.addEventListener('click', handleExportSummary);
    }

    const exportRegressionBtn = document.getElementById('export-regression-btn');
    if (exportRegressionBtn) {
        exportRegressionBtn.addEventListener('click', handleExportRegression);
    }

    const exportDataBtn = document.getElementById('export-data-btn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', handleExportData);
    }

    const exportChartsBtn = document.getElementById('export-charts-btn');
    if (exportChartsBtn) {
        exportChartsBtn.addEventListener('click', handleExportCharts);
    }

    const exportReportBtn = document.getElementById('export-report-btn');
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', handleExportReport);
    }

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

    if (!data || data.length === 0) {
        console.warn('No data to analyze');
        return;
    }

    // Get current selections
    const outcomeVar = getCurrentOutcome();
    const predictorVar = getCurrentPredictor();
    const state = getState();
    const weightType = getWeightType();

    // Get unique countries and years
    const countries = [...new Set(data.map(d => d.country))];
    const years = [...new Set(data.map(d => d.year))];

    console.log('Data summary:');
    console.log('- Students:', data.length);
    console.log('- Countries:', countries.length, '-', countries.join(', '));
    console.log('- Years:', years.length, '-', years.join(', '));

    try {
        // 1. Calculate descriptive statistics
        const descriptive = calculateDescriptiveStats(data, outcomeVar, weightType);
        const inequality = calculateInequalityMeasures(data, outcomeVar, weightType);
        const gradient = calculateSESGradient(data, outcomeVar, predictorVar, weightType);

        console.log('✓ Descriptive statistics calculated');
        console.log('  - Mean:', descriptive?.mean?.toFixed(2));
        console.log('  - Gini:', inequality?.gini?.toFixed(3));
        console.log('  - Gradient:', gradient?.toFixed(2));

        // 2. Update overview stats and chart
        updateOverviewStats(data, outcomeVar, predictorVar, weightType);
        renderOverviewChart(data, outcomeVar, predictorVar, weightType);

        console.log('✓ Overview tab updated');

        // 3. Calculate comparative statistics by country-year
        const comparativeResults = calculateComparativeStats(data, outcomeVar, predictorVar, weightType);

        // 4. Store results in state
        setState({
            analysisResults: {
                descriptive,
                inequality,
                gradient,
                comparative: comparativeResults
            }
        });

        console.log('✓ Initial analyses complete');

    } catch (error) {
        console.error('Error in initial analyses:', error);
    }
}

/**
 * Calculate comparative statistics (by country and year)
 * @param {Array} data - Student data
 * @param {String} outcomeVar - Outcome variable
 * @param {String} predictorVar - Predictor variable
 * @param {String} weightType - Weight type
 * @returns {Object} Comparative results
 */
function calculateComparativeStats(data, outcomeVar, predictorVar, weightType) {
    const results = {};
    const countries = [...new Set(data.map(d => d.country))];
    const years = [...new Set(data.map(d => d.year))];

    countries.forEach(country => {
        results[country] = {};

        years.forEach(year => {
            const subData = data.filter(d => d.country === country && d.year === year);

            if (subData.length > 0) {
                const stats = calculateDescriptiveStats(subData, outcomeVar, weightType);
                const ineq = calculateInequalityMeasures(subData, outcomeVar, weightType);
                const grad = calculateSESGradient(subData, outcomeVar, predictorVar, weightType);

                results[country][year] = {
                    mean: stats?.mean || NaN,
                    gini: ineq?.gini || NaN,
                    predictorGradient: grad || NaN,
                    n: subData.length
                };
            }
        });
    });

    return results;
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

/**
 * Get selected weight type
 * @returns {String} Weight type
 */
function getWeightType() {
    const weightSelect = document.getElementById('weight-type');
    return weightSelect ? weightSelect.value : 'student';
}

/**
 * Render gap decomposition analysis
 * @param {Array} data - Student data
 * @param {String} outcomeVar - Outcome variable
 * @param {String} predictorVar - Predictor variable
 * @param {String} weightType - Weight type
 */
function renderGapDecomposition(data, outcomeVar, predictorVar, weightType) {
    console.log('Rendering gap decomposition...');

    const gap = decomposeAchievementGap(data, outcomeVar, predictorVar, weightType);
    const decomp = calculateVarianceDecomposition(data, outcomeVar);

    if (!gap && !decomp) {
        console.warn('No gap decomposition results');
        return;
    }

    const resultsDiv = document.getElementById('gap-results');
    if (!resultsDiv) return;

    let html = '<div class="grid-2" style="gap: 2rem;">';

    // Achievement gap card
    if (gap) {
        html += `
            <div class="stat-card">
                <h3>Achievement Gap (Q4-Q1 SES)</h3>
                <div class="methodology-note">
                    <strong>Gap:</strong> ${gap.gap_q4_q1.toFixed(2)} score points<br>
                    <strong>Effect Size:</strong> ${gap.effect_size.toFixed(2)} (Cohen's d)<br>
                    <strong>Q1 Mean:</strong> ${gap.q1.mean.toFixed(2)} (n=${gap.q1.n})<br>
                    <strong>Q4 Mean:</strong> ${gap.q4.mean.toFixed(2)} (n=${gap.q4.n})
                </div>
            </div>
        `;
    }

    // Variance decomposition card
    if (decomp) {
        html += `
            <div class="stat-card">
                <h3>Variance Decomposition</h3>
                <div class="methodology-note">
                    <strong>Total Variance:</strong> ${decomp.totalVariance.toFixed(2)}<br>
                    <strong>Within-country:</strong> ${decomp.percentWithin.toFixed(1)}%<br>
                    <strong>Between-country:</strong> ${decomp.percentBetween.toFixed(1)}%<br>
                    <strong>ICC (ρ):</strong> ${decomp.icc.toFixed(3)}
                </div>
            </div>
        `;
    }

    html += '</div>';
    resultsDiv.innerHTML = html;
}

/**
 * Determine which regression models are appropriate for the data structure
 * @param {Array} data - Student data
 * @returns {Object} Object indicating which models can be run
 */
function determineApplicableModels(data) {
    // Count unique countries and years
    const uniqueCountries = [...new Set(data.map(d => d.country))];
    const uniqueYears = [...new Set(data.map(d => d.year))];

    const nCountries = uniqueCountries.length;
    const nYears = uniqueYears.length;

    console.log(`Data structure: ${nCountries} countries, ${nYears} years`);

    return {
        canRunOLS: true, // OLS always applicable
        canRunFE: nCountries > 1, // Need multiple countries for country FE
        canRunRE: nCountries > 1, // Need multiple countries for RE
        nCountries,
        nYears,
        isSingleCountry: nCountries === 1,
        isSingleYear: nYears === 1,
        message: nCountries === 1
            ? 'Single country selected: Only OLS regression available (FE/RE require multiple countries)'
            : nYears === 1
            ? 'Single year selected: FE and RE available without year controls'
            : null
    };
}

/**
 * Run and render regression analyses
 * @param {Array} data - Student data
 * @param {String} outcomeVar - Outcome variable
 * @param {String} predictorVar - Predictor variable
 * @param {String} weightType - Weight type
 */
function runRegressionAnalyses(data, outcomeVar, predictorVar, weightType) {
    console.log('Running regression analyses...');

    const controls = getSelectedControls();
    const models = {};

    // Determine which models are appropriate for this data
    const applicable = determineApplicableModels(data);

    // Check which models are selected
    const wantOLS = document.getElementById('ols-model')?.checked !== false; // Default true
    const wantFE = document.getElementById('fe-model')?.checked !== false; // Default true
    const wantRE = document.getElementById('re-model')?.checked !== false; // Default true

    // Show info message if models are restricted
    if (applicable.message) {
        console.warn(applicable.message);
    }

    try {
        if (wantOLS && applicable.canRunOLS) {
            const ols = runPooledOLS(data, outcomeVar, predictorVar, controls, weightType);
            if (ols) models.ols = ols;
        }

        if (wantFE && applicable.canRunFE) {
            const fe = runFixedEffects(data, outcomeVar, predictorVar, controls, weightType);
            if (fe) models.fixedEffects = fe;
        } else if (wantFE && !applicable.canRunFE) {
            console.log('Skipping Fixed Effects: requires multiple countries');
        }

        if (wantRE && applicable.canRunRE) {
            const re = runRandomEffects(data, outcomeVar, predictorVar, controls, weightType);
            if (re) models.randomEffects = re;
        } else if (wantRE && !applicable.canRunRE) {
            console.log('Skipping Random Effects: requires multiple countries');
        }

        // Render results
        renderRegressionComparison(models);

        // Show info message if models were skipped
        if (applicable.message) {
            const resultsDiv = document.getElementById('regression-results');
            if (resultsDiv) {
                const infoBox = document.createElement('div');
                infoBox.className = 'alert alert-info';
                infoBox.style.marginTop = '1rem';
                infoBox.innerHTML = `<strong>ℹ️ Note:</strong> ${applicable.message}`;
                resultsDiv.insertBefore(infoBox, resultsDiv.firstChild);
            }
        }

        // Render coefficient plot
        const predLabel = getPredictorLabel(predictorVar);
        renderCoefficientPlot(models, predLabel);

        // Render regression scatter plots with fitted lines
        renderRegressionScatterPlots(data, outcomeVar, predictorVar, models);

        // Hausman test if both FE and RE are available
        if (models.fixedEffects && models.randomEffects) {
            const hausman = hausmanTest(models.fixedEffects, models.randomEffects, predLabel);
            if (hausman) {
                renderHausmanTest(hausman);
            }
        }

        // Render residual plots and QQ plots for diagnostics tab
        if (models.ols) {
            renderResidualPlot(models.ols, 'OLS (Pooled)', 'residual-plot-ols');
            renderQQPlot(models.ols, 'OLS (Pooled)', 'qq-plot-ols');
        }
        if (models.fixedEffects) {
            renderResidualPlot(models.fixedEffects, 'Fixed Effects', 'residual-plot-fe');
            renderQQPlot(models.fixedEffects, 'Fixed Effects', 'qq-plot-fe');
        }
        if (models.randomEffects) {
            renderResidualPlot(models.randomEffects, 'Random Effects', 'residual-plot-re');
            renderQQPlot(models.randomEffects, 'Random Effects', 'qq-plot-re');
        }

        console.log('✓ Regression analyses complete');

    } catch (error) {
        console.error('Error in regression analyses:', error);
    }
}

/**
 * Render diagnostics tab
 * @param {Array} data - Student data
 * @param {String} outcomeVar - Outcome variable
 */
function renderDiagnostics(data, outcomeVar) {
    console.log('Rendering diagnostics...');

    const decomp = calculateVarianceDecomposition(data, outcomeVar);
    if (!decomp) return;

    const diagnosticsDiv = document.getElementById('diagnostics-results');
    if (!diagnosticsDiv) return;

    const html = `
        <div class="stat-card">
            <h3>Variance Decomposition</h3>
            <div class="methodology-note">
                <strong>Within-country variance:</strong> ${decomp.withinVariance.toFixed(2)} (${decomp.percentWithin.toFixed(1)}%)<br>
                <strong>Between-country variance:</strong> ${decomp.betweenVariance.toFixed(2)} (${decomp.percentBetween.toFixed(1)}%)<br>
                <strong>Intraclass correlation (ICC):</strong> ${decomp.icc.toFixed(3)}<br><br>
                <em>ICC = ${decomp.icc.toFixed(3)} means ${(decomp.icc * 100).toFixed(1)}% of total variance in achievement is due to differences between countries.</em>
            </div>
        </div>
    `;

    diagnosticsDiv.innerHTML = html;
}

/**
 * Get predictor label for display
 * @param {String} predictor - Predictor variable name
 * @returns {String} Display label
 */
function getPredictorLabel(predictor) {
    const labels = {
        'escs': 'Socioeconomic Status (ESCS)',
        'parent_edu': 'Parental Education'
    };
    return labels[predictor] || predictor;
}

/**
 * Export handlers
 */
function handleExportSummary() {
    const state = getState();

    if (!state.mergedData || state.mergedData.length === 0) {
        alert('No data loaded. Please load data before exporting.');
        return;
    }

    exportComprehensiveSummary(state);
}

function handleExportRegression() {
    const state = getState();

    if (!state.mergedData || state.mergedData.length === 0) {
        alert('No data loaded. Please load data before exporting.');
        return;
    }

    // Run regressions and export
    const outcomeVar = getCurrentOutcome();
    const predictorVar = getCurrentPredictor();
    const weightType = getWeightType();
    const controls = getSelectedControls();

    const models = {};
    try {
        const ols = runPooledOLS(state.mergedData, outcomeVar, predictorVar, controls, weightType);
        if (ols) models.ols = ols;

        const fe = runFixedEffects(state.mergedData, outcomeVar, predictorVar, controls, weightType);
        if (fe) models.fixedEffects = fe;

        const re = runRandomEffects(state.mergedData, outcomeVar, predictorVar, controls, weightType);
        if (re) models.randomEffects = re;

        if (Object.keys(models).length > 0) {
            exportAllRegressionModels(models);
        } else {
            alert('No regression models available to export.');
        }
    } catch (error) {
        console.error('Error exporting regressions:', error);
        alert(`Error exporting regressions: ${error.message}`);
    }
}

function handleExportData() {
    const state = getState();

    if (!state.mergedData || state.mergedData.length === 0) {
        alert('No data loaded. Please load data before exporting.');
        return;
    }

    exportCurrentDataset(state.mergedData, state);
}

function handleExportCharts() {
    const state = getState();

    if (!state.mergedData || state.mergedData.length === 0) {
        alert('No data loaded. Please load data and view charts before exporting.');
        return;
    }

    exportAllAnalysisCharts('png');
}

async function handleExportReport() {
    const state = getState();

    if (!state.mergedData || state.mergedData.length === 0) {
        alert('No data loaded. Please load data before generating a report.');
        return;
    }

    // Show loading message
    alert('Generating comprehensive analysis report...\n\nThis may take a few seconds as charts are being captured.');

    try {
        await generateFullReport(state);
    } catch (error) {
        console.error('Error generating report:', error);
        alert(`Error generating report: ${error.message}`);
    }
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
