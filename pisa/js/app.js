/**
 * PISA Educational Inequality Explorer - Main Application
 * Author: Kevin Schoenholzer
 * Date: 2025-12-15
 */

// Import modules
import { getState, setState, setLoading, getCurrentOutcome, setCurrentOutcome,
         getCurrentPredictor, setCurrentPredictor, setAnalysisType, getAnalysisType } from './core/state-manager.js';
import { loadMetadata, loadSelectedData, getCacheStats } from './core/data-loader.js';
import { initLoadingIndicator, updateProgress, showDataStatus, hideLoading,
         showButtonSpinner, hideButtonSpinner, resetProgress } from './ui/loading-indicator.js';
import { initSelectors, populateFromMetadata } from './ui/country-selector.js';

// Import analysis modules
import { calculateDescriptiveStats, calculateInequalityMeasures, calculateSESGradient,
         calculateStatsByGroup } from './analysis/descriptive.js';
import { runPooledOLS, runFixedEffects, runRandomEffects } from './analysis/regression.js';
import { decomposeAchievementGap, calculateVarianceDecomposition, calculateGapTrend, calculateComparativeDecomposition } from './analysis/decomposition.js';
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
        // initAdvancedOptions(); // Removed - no longer needed without sidebar
        initEventListeners();

        // Make regression functions available globally for visualizations
        window.runPooledOLS = runPooledOLS;
        window.runFixedEffects = runFixedEffects;
        window.runRandomEffects = runRandomEffects;

        // Make decomposition functions available globally
        window.calculateGapTrend = calculateGapTrend;
        window.calculateComparativeDecomposition = calculateComparativeDecomposition;
        window.decomposeAchievementGap = decomposeAchievementGap;
        window.calculateVarianceDecomposition = calculateVarianceDecomposition;

        // Make descriptive stats available globally for report generation
        window.calculateDescriptiveStats = calculateDescriptiveStats;

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
 * Clear Plotly charts from non-active tabs to save memory
 * @param {String} activeTab - Currently active tab name
 */
function clearInactivePlotlyCharts(activeTab) {
    // Map tabs to their chart div IDs
    const tabCharts = {
        'overview': ['overview-chart'],
        'distribution': ['distribution-chart', 'percentile-chart', 'lorenz-curve'],
        'gap-decomposition': ['gap-plot'],
        'regression': ['coefficient-plot', 'regression-scatter-plots'],
        'diagnostics': ['residual-plot-ols', 'residual-plot-fe', 'residual-plot-re',
                       'qq-plot-ols', 'qq-plot-fe', 'qq-plot-re', 'decomposition-chart'],
        'comparative': ['country-comparison', 'world-map', 'temporal-trends', 'gap-comparison']
    };

    // Clear charts from all tabs except the active one
    Object.keys(tabCharts).forEach(tab => {
        if (tab !== activeTab) {
            tabCharts[tab].forEach(chartId => {
                const chartDiv = document.getElementById(chartId);
                if (chartDiv && typeof Plotly !== 'undefined') {
                    try {
                        Plotly.purge(chartDiv);
                    } catch (e) {
                        // Chart might not exist yet, ignore
                    }
                }
            });
        }
    });
}

/**
 * Handle tab switching
 * @param {String} tabName - Name of activated tab
 */
function onTabSwitch(tabName) {
    const state = getState();

    // Clear Plotly charts from inactive tabs to save memory
    clearInactivePlotlyCharts(tabName);

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
 * DEPRECATED - No longer needed with tab-based layout
 */
// function initAdvancedOptions() {
//     const header = document.getElementById('advanced-options-header');
//     const content = document.getElementById('advanced-options-content');

//     if (header && content) {
//         header.addEventListener('click', () => {
//             header.classList.toggle('expanded');
//             content.classList.toggle('expanded');
//         });
//     }

//     console.log('Advanced options initialized');
// }

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

    // Gap granularity selector
    const gapGranularitySelect = document.getElementById('gap-granularity');
    if (gapGranularitySelect) {
        gapGranularitySelect.addEventListener('change', (e) => {
            console.log('Gap granularity changed to:', e.target.value);

            // Re-render gap decomposition if data is loaded
            const state = getState();
            if (state.mergedData && state.mergedData.length > 0) {
                const data = state.mergedData;
                const outcomeVar = getCurrentOutcome();
                const predictorVar = getCurrentPredictor();
                const weightType = getWeightType();
                renderGapDecomposition(data, outcomeVar, predictorVar, weightType);
            }
        });
    }

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

    // DEPRECATED: Optional visualization toggles removed - all visualizations now auto-render
    // Visualization checkboxes and render buttons have been removed from the UI

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

    const granularitySelect = document.getElementById('gap-granularity');
    const granularity = granularitySelect ? granularitySelect.value : 'overall';

    const resultsDiv = document.getElementById('gap-results');
    if (!resultsDiv) return;

    let html = '';

    // Import decomposition functions
    const { calculateGapTrend, calculateComparativeDecomposition } = window;

    if (granularity === 'overall') {
        // Overall gap across all data
        const gap = decomposeAchievementGap(data, outcomeVar, predictorVar, weightType);
        const decomp = calculateVarianceDecomposition(data, outcomeVar);

        if (!gap && !decomp) {
            console.warn('No gap decomposition results');
            return;
        }

        html = '<div class="grid-2" style="gap: 2rem;">';

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

    } else if (granularity === 'by-country') {
        // Gap by country
        const comparative = calculateComparativeDecomposition(data, outcomeVar, predictorVar, weightType);

        if (!comparative || !comparative.byCountry) {
            html = '<p>No country-level gap data available.</p>';
        } else {
            html = '<div class="table-container"><table class="results-table">';
            html += '<thead><tr><th>Country</th><th>Gap (Q4-Q1)</th><th>Effect Size</th><th>Q1 Mean</th><th>Q4 Mean</th><th>N</th></tr></thead><tbody>';

            comparative.ranked.forEach(country => {
                const gap = comparative.byCountry[country];
                if (gap) {
                    html += `<tr>
                        <td><strong>${country}</strong></td>
                        <td>${gap.gap_q4_q1.toFixed(2)}</td>
                        <td>${gap.effect_size.toFixed(2)}</td>
                        <td>${gap.q1.mean.toFixed(2)}</td>
                        <td>${gap.q4.mean.toFixed(2)}</td>
                        <td>${(gap.q1.n + gap.q4.n).toLocaleString()}</td>
                    </tr>`;
                }
            });

            html += '</tbody></table></div>';

            // Render visualization
            renderGapPlot(comparative.byCountry, 'country', outcomeVar);
        }

    } else if (granularity === 'by-year') {
        // Gap by year
        const trends = calculateGapTrend(data, outcomeVar, predictorVar, weightType);

        if (!trends || !trends.byYear) {
            html = '<p>No year-level gap data available.</p>';
        } else {
            html = '<div class="table-container"><table class="results-table">';
            html += '<thead><tr><th>Year</th><th>Gap (Q4-Q1)</th><th>Effect Size</th><th>Q1 Mean</th><th>Q4 Mean</th><th>N</th></tr></thead><tbody>';

            trends.years.forEach(year => {
                const gap = trends.byYear[year];
                if (gap) {
                    html += `<tr>
                        <td><strong>${year}</strong></td>
                        <td>${gap.gap_q4_q1.toFixed(2)}</td>
                        <td>${gap.effect_size.toFixed(2)}</td>
                        <td>${gap.q1.mean.toFixed(2)}</td>
                        <td>${gap.q4.mean.toFixed(2)}</td>
                        <td>${(gap.q1.n + gap.q4.n).toLocaleString()}</td>
                    </tr>`;
                }
            });

            html += '</tbody></table></div>';

            if (trends.trend !== null) {
                html += `<div class="stat-card" style="margin-top: 1rem;">
                    <h3>Temporal Trend</h3>
                    <div class="methodology-note">
                        <strong>Trend:</strong> ${trends.interpretation} (${trends.trend.toFixed(2)} points/year)
                    </div>
                </div>`;
            }

            // Render visualization
            renderGapPlot(trends.byYear, 'year', outcomeVar);
        }

    } else if (granularity === 'by-country-year') {
        // Gap by country × year
        const countries = [...new Set(data.map(d => d.country))].sort();
        const years = [...new Set(data.map(d => d.year))].sort();

        const gapsByCountryYear = {};
        countries.forEach(country => {
            years.forEach(year => {
                const countryYearData = data.filter(d => d.country === country && d.year === year);
                if (countryYearData.length > 100) { // Minimum sample size
                    const gap = decomposeAchievementGap(countryYearData, outcomeVar, predictorVar, weightType);
                    if (!gapsByCountryYear[country]) {
                        gapsByCountryYear[country] = {};
                    }
                    gapsByCountryYear[country][year] = gap;
                }
            });
        });

        html = '<div class="table-container"><table class="results-table">';
        html += '<thead><tr><th>Country</th><th>Year</th><th>Gap (Q4-Q1)</th><th>Effect Size</th><th>Q1 Mean</th><th>Q4 Mean</th><th>N</th></tr></thead><tbody>';

        Object.keys(gapsByCountryYear).sort().forEach(country => {
            Object.keys(gapsByCountryYear[country]).sort().forEach(year => {
                const gap = gapsByCountryYear[country][year];
                if (gap) {
                    html += `<tr>
                        <td><strong>${country}</strong></td>
                        <td>${year}</td>
                        <td>${gap.gap_q4_q1.toFixed(2)}</td>
                        <td>${gap.effect_size.toFixed(2)}</td>
                        <td>${gap.q1.mean.toFixed(2)}</td>
                        <td>${gap.q4.mean.toFixed(2)}</td>
                        <td>${(gap.q1.n + gap.q4.n).toLocaleString()}</td>
                    </tr>`;
                }
            });
        });

        html += '</tbody></table></div>';

        // Render visualization
        renderGapPlot(gapsByCountryYear, 'country-year', outcomeVar);
    }

    resultsDiv.innerHTML = html;
}

/**
 * Render gap visualization (bar chart)
 * @param {Object} gapData - Gap data by country, year, or country-year
 * @param {String} type - 'country', 'year', or 'country-year'
 * @param {String} outcomeVar - Outcome variable
 */
function renderGapPlot(gapData, type, outcomeVar) {
    const chartDiv = document.getElementById('gap-plot');
    if (!chartDiv) return;

    let traces = [];

    if (type === 'country') {
        // Bar chart by country
        const countries = Object.keys(gapData).filter(c => gapData[c] && isFinite(gapData[c].gap_q4_q1));
        countries.sort((a, b) => gapData[a].gap_q4_q1 - gapData[b].gap_q4_q1);

        const gaps = countries.map(c => gapData[c].gap_q4_q1);
        const effectSizes = countries.map(c => gapData[c].effect_size);

        traces.push({
            x: countries,
            y: gaps,
            name: 'Gap (Q4-Q1)',
            type: 'bar',
            marker: { color: '#3b82f6' },
            yaxis: 'y'
        });

        traces.push({
            x: countries,
            y: effectSizes,
            name: 'Effect Size',
            type: 'scatter',
            mode: 'markers+lines',
            marker: { size: 10, color: '#ef4444' },
            line: { color: '#ef4444', width: 2 },
            yaxis: 'y2'
        });

    } else if (type === 'year') {
        // Bar chart by year
        const years = Object.keys(gapData).filter(y => gapData[y] && isFinite(gapData[y].gap_q4_q1));
        years.sort();

        const gaps = years.map(y => gapData[y].gap_q4_q1);

        traces.push({
            x: years,
            y: gaps,
            name: 'Gap (Q4-Q1)',
            type: 'bar',
            marker: { color: '#10b981' }
        });

    } else if (type === 'country-year') {
        // Grouped bar chart by country and year
        const countries = Object.keys(gapData).sort();
        const allYears = new Set();

        countries.forEach(country => {
            Object.keys(gapData[country]).forEach(year => allYears.add(year));
        });

        const years = Array.from(allYears).sort();

        years.forEach(year => {
            const gaps = [];
            const countryNames = [];

            countries.forEach(country => {
                if (gapData[country][year] && isFinite(gapData[country][year].gap_q4_q1)) {
                    gaps.push(gapData[country][year].gap_q4_q1);
                    countryNames.push(country);
                }
            });

            if (gaps.length > 0) {
                traces.push({
                    x: countryNames,
                    y: gaps,
                    name: `Year ${year}`,
                    type: 'bar'
                });
            }
        });
    }

    const layout = {
        title: {
            text: `Achievement Gap by ${type === 'country' ? 'Country' : type === 'year' ? 'Year' : 'Country × Year'}`,
            font: { color: '#f1f5f9', size: 16 }
        },
        xaxis: {
            title: type === 'year' ? 'Year' : 'Country',
            gridcolor: '#334155'
        },
        yaxis: {
            title: 'Achievement Gap (Q4-Q1 score points)',
            gridcolor: '#334155'
        },
        paper_bgcolor: '#1e293b',
        plot_bgcolor: '#1e293b',
        font: { color: '#f1f5f9' },
        barmode: type === 'country-year' ? 'group' : 'relative',
        showlegend: type === 'country-year' || type === 'country',
        margin: { l: 60, r: type === 'country' ? 120 : 40, t: 80, b: 80 }
    };

    // Add second y-axis for country comparison (effect size)
    if (type === 'country') {
        layout.yaxis2 = {
            title: 'Effect Size (Cohen\'s d)',
            overlaying: 'y',
            side: 'right',
            gridcolor: 'transparent'
        };
    }

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
    };

    Plotly.newPlot(chartDiv, traces, layout, config);
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
 * Run separate regressions for each country-year combination
 * @param {Array} data - Student data
 * @param {String} outcomeVar - Outcome variable
 * @param {String} predictorVar - Predictor variable
 * @param {String} weightType - Weight type
 * @param {Array} controls - Control variables
 */
function runSeparateRegressions(data, outcomeVar, predictorVar, weightType, controls) {
    console.log('Running separate country-year regressions...');

    // Group data by country-year
    const byCountryYear = {};
    data.forEach(d => {
        const key = `${d.country}_${d.year}`;
        if (!byCountryYear[key]) {
            byCountryYear[key] = {
                country: d.country,
                year: d.year,
                data: []
            };
        }
        byCountryYear[key].data.push(d);
    });

    // Run OLS for each country-year
    const results = [];
    Object.values(byCountryYear).forEach(entry => {
        const { country, year, data: groupData } = entry;

        if (groupData.length < 50) {
            console.warn(`Skipping ${country} ${year}: insufficient sample size (N=${groupData.length})`);
            return;
        }

        try {
            const ols = runPooledOLS(groupData, outcomeVar, predictorVar, controls, weightType);
            if (ols && ols.coefficients && ols.coefficients.length > 1) {
                results.push({
                    country,
                    year,
                    gradient: ols.coefficients[1], // Coefficient on predictor
                    se: ols.standardErrors[1],
                    tStat: ols.tStatistics[1], // Note: property is tStatistics not tStats
                    pValue: ols.pValues[1],
                    r2: ols.r2,
                    adjR2: ols.adjR2,
                    aic: ols.aic,
                    bic: ols.bic,
                    n: ols.nobs
                });
            } else {
                console.warn(`Skipping ${country} ${year}: invalid model (${ols ? `${ols.coefficients?.length || 0} coefficients` : 'no model'})`);
            }
        } catch (error) {
            console.warn(`Error running regression for ${country} ${year}:`, error.message);
        }
    });

    // Sort by country then year
    results.sort((a, b) => {
        if (a.country !== b.country) return a.country.localeCompare(b.country);
        return a.year - b.year;
    });

    console.log(`✓ Completed ${results.length} separate regressions`);

    // Render results table
    renderSeparateRegressionTable(results, predictorVar);

    // Clear other visualizations since they don't apply to separate analysis
    const elements = [
        'coefficient-plot', 'hausman-test', 'regression-scatter-plots',
        'residual-plot-ols', 'residual-plot-fe', 'residual-plot-re',
        'qq-plot-ols', 'qq-plot-fe', 'qq-plot-re'
    ];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    // Add info message
    const resultsDiv = document.getElementById('regression-results');
    if (resultsDiv) {
        const infoBox = document.createElement('div');
        infoBox.className = 'alert alert-info';
        infoBox.style.marginTop = '1rem';
        infoBox.innerHTML = `<strong>ℹ️ Separate Analysis Mode:</strong> Running OLS regression for each country-year combination independently. Showing ${results.length} regressions.`;
        resultsDiv.insertBefore(infoBox, resultsDiv.firstChild);
    }
}

/**
 * Render table of separate regression results
 * @param {Array} results - Array of regression results for each country-year
 * @param {String} predictorVar - Name of predictor variable
 */
function renderSeparateRegressionTable(results, predictorVar) {
    const resultsDiv = document.getElementById('regression-results');
    if (!resultsDiv) return;

    const predLabel = getPredictorLabel(predictorVar);

    let html = `
        <div class="stat-card">
            <h3 style="margin-bottom: 1rem;">Separate Regression Results by Country-Year</h3>
            <p style="color: #888; margin-bottom: 1rem; font-size: 0.9rem;">
                OLS regression of achievement on ${predLabel}, estimated separately for each country-year combination.
            </p>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #1e293b; border-bottom: 2px solid #475569;">
                            <th style="padding: 0.75rem; text-align: left;">Country</th>
                            <th style="padding: 0.75rem; text-align: center;">Year</th>
                            <th style="padding: 0.75rem; text-align: right;">Gradient</th>
                            <th style="padding: 0.75rem; text-align: right;">Std. Error</th>
                            <th style="padding: 0.75rem; text-align: right;">t-stat</th>
                            <th style="padding: 0.75rem; text-align: right;">p-value</th>
                            <th style="padding: 0.75rem; text-align: right;">R²</th>
                            <th style="padding: 0.75rem; text-align: right;">Adj. R²</th>
                            <th style="padding: 0.75rem; text-align: right;">N</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    results.forEach((r, idx) => {
        const bgColor = idx % 2 === 0 ? '#0f172a' : '#1e293b';
        const significant = r.pValue < 0.05;
        const gradientStyle = significant ? 'font-weight: 600; color: #3b82f6;' : '';

        html += `
            <tr style="background: ${bgColor}; border-bottom: 1px solid #334155;">
                <td style="padding: 0.75rem;">${r.country}</td>
                <td style="padding: 0.75rem; text-align: center;">${r.year}</td>
                <td style="padding: 0.75rem; text-align: right; ${gradientStyle}">${r.gradient.toFixed(3)}</td>
                <td style="padding: 0.75rem; text-align: right;">${r.se.toFixed(3)}</td>
                <td style="padding: 0.75rem; text-align: right;">${r.tStat.toFixed(2)}</td>
                <td style="padding: 0.75rem; text-align: right;">${r.pValue < 0.001 ? '<0.001' : r.pValue.toFixed(3)}</td>
                <td style="padding: 0.75rem; text-align: right;">${(r.r2 * 100).toFixed(1)}%</td>
                <td style="padding: 0.75rem; text-align: right;">${(r.adjR2 * 100).toFixed(1)}%</td>
                <td style="padding: 0.75rem; text-align: right;">${r.n.toLocaleString()}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
            <p style="margin-top: 1rem; font-size: 0.85rem; color: #888;">
                <strong>Note:</strong> Gradients shown in blue are statistically significant at p < 0.05.
                Gradient represents the change in achievement score per 1 SD increase in ${predLabel}.
            </p>
        </div>
    `;

    resultsDiv.innerHTML = html;
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

    const analysisType = getAnalysisType();
    const controls = getSelectedControls();

    // Check if separate analysis is selected
    if (analysisType === 'separate') {
        runSeparateRegressions(data, outcomeVar, predictorVar, weightType, controls);
        return;
    }

    // Pooled analysis (default)
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

        // Always render all regression visualizations
        renderCoefficientPlot(models, predictorVar);
        renderRegressionScatterPlots(data, outcomeVar, predictorVar, models);

        // Hausman test if both FE and RE are available
        if (models.fixedEffects && models.randomEffects) {
            const hausman = hausmanTest(models.fixedEffects, models.randomEffects, predLabel);
            if (hausman) {
                renderHausmanTest(hausman);
            }
        }

        // Store models globally for diagnostics tab to access
        window.lastRegressionModels = models;

        console.log('✓ Regression analyses complete');

    } catch (error) {
        console.error('Error in regression analyses:', error);
    }
}

/**
 * Render diagnostics tab with all diagnostic plots
 * @param {Array} data - Student data
 * @param {String} outcomeVar - Outcome variable
 */
function renderDiagnostics(data, outcomeVar) {
    console.log('Rendering diagnostics...');

    // Get the stored regression models from the last regression run
    const models = window.lastRegressionModels || {};

    // Always render residual and QQ plots for all available models
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

    console.log('✓ Diagnostics rendered');
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
    alert('Generating comprehensive analysis report...\n\nThis may take a few seconds as all visualizations are being rendered and captured.');

    try {
        // Force render ALL visualizations before exporting
        console.log('Pre-rendering all visualizations for report...');
        await renderAllVisualizationsForReport();

        // Wait a bit for Plotly to finish rendering all charts
        await new Promise(resolve => setTimeout(resolve, 1000));

        await generateFullReport(state);
    } catch (error) {
        console.error('Error generating report:', error);
        alert(`Error generating report: ${error.message}`);
    }
}

/**
 * Render all visualizations across all tabs for report generation
 * This ensures every chart is available for capture, regardless of which tabs/options the user selected
 */
async function renderAllVisualizationsForReport() {
    const state = getState();
    const data = state.mergedData;
    const outcomeVar = getCurrentOutcome();
    const predictorVar = getCurrentPredictor();
    const weightType = getWeightType();

    console.log('Rendering all tabs and visualizations...');

    // 1. Overview tab
    updateOverviewStats(data, outcomeVar, predictorVar, weightType);
    renderOverviewChart(data, outcomeVar, predictorVar, weightType);

    // 2. Distribution tab
    renderAllDistributionCharts(data, outcomeVar);

    // 3. Gap decomposition tab - render all granularity levels
    // Save current granularity
    const gapSelect = document.getElementById('gap-granularity');
    const originalGranularity = gapSelect ? gapSelect.value : 'overall';

    // Render overall view (which includes variance decomposition)
    if (gapSelect) gapSelect.value = 'overall';
    renderGapDecomposition(data, outcomeVar, predictorVar, weightType);

    // 4. Regression tab - run all analyses (visualizations auto-render)
    runRegressionAnalyses(data, outcomeVar, predictorVar, weightType);

    // 5. Diagnostics - render all diagnostic plots
    renderDiagnostics(data, outcomeVar);

    // 6. Comparative tab
    const comparativeResults = state.analysisResults?.comparative;
    if (comparativeResults) {
        renderAllComparativeCharts(data, comparativeResults, outcomeVar);
    }

    // Restore original gap granularity
    if (gapSelect) {
        gapSelect.value = originalGranularity;
        renderGapDecomposition(data, outcomeVar, predictorVar, weightType);
    }

    console.log('✓ All visualizations rendered for report');
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
