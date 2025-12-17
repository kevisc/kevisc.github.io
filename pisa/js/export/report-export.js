/**
 * Report Export Module
 * Generates comprehensive HTML analysis reports
 * Author: Kevin Schoenholzer
 * Date: 2025-12-16
 */

import { getChartAsBase64PNG } from './figure-export.js';

/**
 * Generate and download complete HTML analysis report
 * @param {Object} state - Application state with all results
 * @param {String} filename - Optional filename
 */
export async function generateFullReport(state, filename = 'pisa_analysis_report.html') {
    if (!state || !state.mergedData) {
        alert('No data loaded. Please load data before generating a report.');
        return;
    }

    console.log('Generating comprehensive analysis report...');

    try {
        // Collect all chart images as base64
        const charts = await collectChartImages();

        // Build HTML report
        const html = await buildReportHTML(state, charts);

        // Download as HTML file
        downloadHTML(html, filename);

        console.log(`✓ Report generated: ${filename}`);
        alert(`Analysis report generated successfully!\n\nFile: ${filename}\n\nThe report is a self-contained HTML file that can be opened in any web browser.`);

    } catch (error) {
        console.error('Error generating report:', error);
        alert(`Error generating report: ${error.message}`);
    }
}

/**
 * Collect all chart images as base64-encoded PNGs
 * @returns {Promise<Object>} Object with chart IDs as keys and base64 data as values
 */
async function collectChartImages() {
    const chartIds = [
        // Overview & Distribution
        'overview-chart',
        'distribution-chart',
        'percentile-chart',
        'lorenz-curve',
        // Achievement Gap
        'gap-plot',
        // Regression
        'regression-scatter',
        'coefficient-plot',
        // Diagnostics
        'residual-plot-ols',
        'residual-plot-fe',
        'residual-plot-re',
        'qq-plot-ols',
        'qq-plot-fe',
        'qq-plot-re',
        'decomposition-chart',
        // Comparative
        'world-map',
        'temporal-trends',
        'country-comparison',
        'gap-comparison'
    ];

    const charts = {};

    for (const chartId of chartIds) {
        const chartDiv = document.getElementById(chartId);
        if (chartDiv && chartDiv.data && chartDiv.data.length > 0) {
            try {
                const base64 = await getChartAsBase64PNG(chartId, 800, 600);
                if (base64) {
                    charts[chartId] = base64;
                    console.log(`✓ Captured chart: ${chartId}`);
                }
            } catch (error) {
                console.warn(`Could not capture chart: ${chartId}`, error);
            }
        } else {
            console.log(`Skipping chart: ${chartId} (no data or not rendered)`);
        }
    }

    return charts;
}

/**
 * Build complete HTML report
 * @param {Object} state - Application state
 * @param {Object} charts - Chart images as base64
 * @returns {Promise<String>} HTML content
 */
async function buildReportHTML(state, charts) {
    const results = state.analysisResults || {};
    const data = state.mergedData || [];

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PISA Educational Inequality Analysis Report</title>
    <style>
        ${getReportStyles()}
    </style>
</head>
<body>
    <div class="container">
        ${buildReportHeader(state)}
        ${buildDataOverview(state, data)}
        ${buildDescriptiveStatistics(results)}
        ${buildInequalityMeasures(results)}
        ${buildGapAnalysis(results, state)}
        ${buildRegressionResults(state)}
        ${buildVarianceDecomposition(results)}
        ${buildComparativeAnalysis(results)}
        ${buildChartsSection(charts)}
        ${buildMethodologySection()}
        ${buildCitationSection()}
        ${buildFooter()}
    </div>
</body>
</html>`;

    return html;
}

/**
 * Get CSS styles for report
 * @returns {String} CSS
 */
function getReportStyles() {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background: #f8fafc;
            padding: 2rem;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 3rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border-radius: 8px;
        }
        h1 {
            color: #0f172a;
            font-size: 2rem;
            margin-bottom: 1rem;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 0.5rem;
        }
        h2 {
            color: #1e293b;
            font-size: 1.5rem;
            margin-top: 2rem;
            margin-bottom: 1rem;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 0.5rem;
        }
        h3 {
            color: #334155;
            font-size: 1.25rem;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
        }
        p {
            margin-bottom: 1rem;
            color: #475569;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
        }
        .subtitle {
            color: #64748b;
            font-size: 1.1rem;
        }
        .metadata {
            background: #f1f5f9;
            padding: 1rem;
            border-radius: 6px;
            margin: 1rem 0;
            font-size: 0.9rem;
        }
        .metadata strong {
            color: #0f172a;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            font-size: 0.9rem;
        }
        th, td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        th {
            background: #f1f5f9;
            font-weight: 600;
            color: #0f172a;
        }
        tr:hover {
            background: #f8fafc;
        }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 1rem 0;
        }
        .stat-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 1rem;
        }
        .stat-card .value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #3b82f6;
            margin: 0.5rem 0;
        }
        .stat-card .label {
            font-size: 0.875rem;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .chart-container {
            margin: 2rem 0;
            text-align: center;
        }
        .chart-container img {
            max-width: 100%;
            height: auto;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
        }
        .chart-caption {
            font-size: 0.875rem;
            color: #64748b;
            margin-top: 0.5rem;
            font-style: italic;
        }
        .alert {
            padding: 1rem;
            border-radius: 6px;
            margin: 1rem 0;
        }
        .alert-info {
            background: #dbeafe;
            border-left: 4px solid #3b82f6;
            color: #1e40af;
        }
        .methodology {
            background: #f8fafc;
            padding: 1.5rem;
            border-radius: 6px;
            margin: 1rem 0;
            border-left: 4px solid #10b981;
        }
        .citation {
            background: #fef3c7;
            padding: 1.5rem;
            border-radius: 6px;
            margin: 1rem 0;
            border-left: 4px solid #f59e0b;
        }
        .footer {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 0.875rem;
        }
        .page-break {
            page-break-after: always;
        }
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .container {
                box-shadow: none;
                padding: 1rem;
            }
        }
    `;
}

/**
 * Build report header
 */
function buildReportHeader(state) {
    const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
        <div class="header">
            <h1>Educational Inequality Analysis Report</h1>
            <p class="subtitle">PISA Assessment Data Explorer</p>
            <div class="metadata">
                <strong>Generated:</strong> ${date}<br>
                <strong>Countries:</strong> ${state.selectedCountries?.join(', ') || 'N/A'}<br>
                <strong>Years:</strong> ${state.selectedYears?.join(', ') || 'N/A'}<br>
                <strong>Total Students:</strong> ${state.mergedData?.length.toLocaleString() || 'N/A'}
            </div>
        </div>
    `;
}

/**
 * Build data overview section
 */
function buildDataOverview(state, data) {
    const countries = [...new Set(data.map(d => d.country))];
    const years = [...new Set(data.map(d => d.year))].sort();
    const outcome = state.currentOutcome || 'math';
    const predictor = state.currentPredictor || 'escs';

    // Calculate basic summary statistics
    const validScores = data.filter(d => isFinite(d[outcome])).map(d => +d[outcome]);
    const mean = validScores.reduce((sum, v) => sum + v, 0) / validScores.length;
    const sorted = validScores.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = Math.min(...validScores);
    const max = Math.max(...validScores);
    const sd = Math.sqrt(validScores.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / validScores.length);

    return `
        <h2>1. Data Overview & Summary Statistics</h2>
        <p>This report presents an analysis of educational inequality using data from the Programme for International Student Assessment (PISA). The analysis examines <strong>${countries.length} ${countries.length === 1 ? 'country' : 'countries'}</strong> across <strong>${years.length} ${years.length === 1 ? 'year' : 'years'}</strong>, totaling <strong>${data.length.toLocaleString()} student observations</strong>.</p>

        <h3>Analysis Parameters</h3>
        <ul>
            <li><strong>Outcome Variable:</strong> ${outcome.charAt(0).toUpperCase() + outcome.slice(1)} Achievement</li>
            <li><strong>Predictor Variable:</strong> ${predictor === 'escs' ? 'ESCS (Economic, Social and Cultural Status)' : 'Parental Education'}</li>
            <li><strong>Years:</strong> ${years.join(', ')}</li>
            <li><strong>Countries:</strong> ${countries.join(', ')}</li>
        </ul>

        <h3>Summary Statistics (${outcome.charAt(0).toUpperCase() + outcome.slice(1)} Scores)</h3>
        <table>
            <thead>
                <tr>
                    <th>Statistic</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>Sample Size</td><td>${validScores.length.toLocaleString()}</td></tr>
                <tr><td>Mean</td><td>${mean.toFixed(2)}</td></tr>
                <tr><td>Median</td><td>${median.toFixed(2)}</td></tr>
                <tr><td>Standard Deviation</td><td>${sd.toFixed(2)}</td></tr>
                <tr><td>Minimum</td><td>${min.toFixed(2)}</td></tr>
                <tr><td>Maximum</td><td>${max.toFixed(2)}</td></tr>
                <tr><td>Range</td><td>${(max - min).toFixed(2)}</td></tr>
            </tbody>
        </table>

        <h3>Sample Composition by Country</h3>
        <table>
            <thead>
                <tr>
                    <th>Country</th>
                    <th>Years</th>
                    <th>Students</th>
                    <th>% of Total</th>
                </tr>
            </thead>
            <tbody>
                ${countries.map(country => {
                    const countryData = data.filter(d => d.country === country);
                    const countryYears = [...new Set(countryData.map(d => d.year))].sort();
                    const pct = (countryData.length / data.length * 100).toFixed(1);
                    return `
                        <tr>
                            <td>${country}</td>
                            <td>${countryYears.join(', ')}</td>
                            <td>${countryData.length.toLocaleString()}</td>
                            <td>${pct}%</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Build descriptive statistics section
 */
function buildDescriptiveStatistics(results) {
    const desc = results.descriptive;
    if (!desc) return '';

    return `
        <h2>2. Descriptive Statistics</h2>
        <p>Summary statistics for achievement scores across all selected countries and years.</p>

        <div class="stat-grid">
            <div class="stat-card">
                <div class="label">Mean Score</div>
                <div class="value">${desc.mean?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="label">Standard Deviation</div>
                <div class="value">${desc.sd?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="label">Median</div>
                <div class="value">${desc.median?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="label">Sample Size</div>
                <div class="value">${desc.n?.toLocaleString() || 'N/A'}</div>
            </div>
        </div>

        <h3>Percentiles</h3>
        <table>
            <thead>
                <tr>
                    <th>Percentile</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>10th (P10)</td><td>${desc.p10?.toFixed(2) || 'N/A'}</td></tr>
                <tr><td>25th (Q1)</td><td>${desc.p25?.toFixed(2) || 'N/A'}</td></tr>
                <tr><td>50th (Median)</td><td>${desc.p50?.toFixed(2) || 'N/A'}</td></tr>
                <tr><td>75th (Q3)</td><td>${desc.p75?.toFixed(2) || 'N/A'}</td></tr>
                <tr><td>90th (P90)</td><td>${desc.p90?.toFixed(2) || 'N/A'}</td></tr>
            </tbody>
        </table>
    `;
}

/**
 * Build inequality measures section
 */
function buildInequalityMeasures(results) {
    const ineq = results.inequality;
    if (!ineq) return '';

    return `
        <h2>3. Inequality Measures</h2>
        <p>Measures of dispersion and inequality in achievement scores.</p>

        <table>
            <thead>
                <tr>
                    <th>Measure</th>
                    <th>Value</th>
                    <th>Interpretation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Gini Coefficient</td>
                    <td>${ineq.gini?.toFixed(4) || 'N/A'}</td>
                    <td>0 = perfect equality, 1 = maximum inequality</td>
                </tr>
                <tr>
                    <td>Coefficient of Variation</td>
                    <td>${ineq.cv?.toFixed(4) || 'N/A'}</td>
                    <td>Standardized measure of dispersion</td>
                </tr>
                <tr>
                    <td>P90/P10 Ratio</td>
                    <td>${ineq.p90p10?.toFixed(2) || 'N/A'}</td>
                    <td>Top 10% score relative to bottom 10%</td>
                </tr>
            </tbody>
        </table>

        ${results.gradient !== undefined ? `
        <h3>SES Gradient</h3>
        <p>The socioeconomic status (SES) gradient measures how much achievement increases per unit increase in SES.</p>
        <div class="stat-card">
            <div class="label">SES Gradient (β)</div>
            <div class="value">${results.gradient?.toFixed(2) || 'N/A'}</div>
            <p style="margin-top: 0.5rem; font-size: 0.875rem;">Score points per 1-unit increase in ESCS index</p>
        </div>
        ` : ''}
    `;
}

/**
 * Build gap analysis section
 */
function buildGapAnalysis(results, state) {
    let html = `
        <div class="page-break"></div>
        <h2>4. Achievement Gap Analysis</h2>
        <p>Analysis of achievement gaps by socioeconomic status quartiles.</p>
    `;

    // Try to get gap data from decomposition calculation
    const data = state.mergedData || [];
    const outcomeVar = state.currentOutcome || 'math';
    const predictorVar = state.currentPredictor || 'escs';
    const weightType = state.weightType || 'student';

    if (data.length > 0 && window.decomposeAchievementGap && window.calculateVarianceDecomposition) {
        try {
            const gap = window.decomposeAchievementGap(data, outcomeVar, predictorVar, weightType);
            const decomp = window.calculateVarianceDecomposition(data, outcomeVar);

            if (gap) {
                html += `
                    <div class="results-table-container">
                        <h3>Achievement Gap (Q4-Q1 SES Quartiles)</h3>
                        <table class="results-table">
                            <thead>
                                <tr>
                                    <th>Measure</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Gap (Q4 - Q1)</td>
                                    <td><strong>${gap.gap_q4_q1.toFixed(2)} points</strong></td>
                                </tr>
                                <tr>
                                    <td>Effect Size (Cohen's d)</td>
                                    <td>${gap.effect_size.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td>Q1 Mean Score</td>
                                    <td>${gap.q1.mean.toFixed(2)} (n=${gap.q1.n.toLocaleString()})</td>
                                </tr>
                                <tr>
                                    <td>Q4 Mean Score</td>
                                    <td>${gap.q4.mean.toFixed(2)} (n=${gap.q4.n.toLocaleString()})</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;
            }

            if (decomp) {
                html += `
                    <div class="results-table-container" style="margin-top: 2rem;">
                        <h3>Variance Decomposition</h3>
                        <table class="results-table">
                            <thead>
                                <tr>
                                    <th>Component</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Total Variance</td>
                                    <td>${decomp.totalVariance.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td>Within-Country Variance</td>
                                    <td>${decomp.varianceWithin.toFixed(2)} (${decomp.percentWithin.toFixed(1)}%)</td>
                                </tr>
                                <tr>
                                    <td>Between-Country Variance</td>
                                    <td>${decomp.varianceBetween.toFixed(2)} (${decomp.percentBetween.toFixed(1)}%)</td>
                                </tr>
                                <tr>
                                    <td>Intraclass Correlation (ICC)</td>
                                    <td>${decomp.icc.toFixed(3)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } catch (error) {
            console.warn('Could not calculate gap analysis for report:', error);
            html += `<p class="alert alert-info">Gap decomposition results available in separate export.</p>`;
        }
    } else {
        html += `<p class="alert alert-info">Gap decomposition results available in separate export.</p>`;
    }

    return html;
}

/**
 * Build regression results section
 */
function buildRegressionResults(state) {
    let html = `
        <div class="page-break"></div>
        <h2>5. Regression Analysis</h2>
        <p>Regression models examining the relationship between socioeconomic status and achievement.</p>
    `;

    // Try to get regression results from state
    const data = state.mergedData || [];
    const outcomeVar = state.currentOutcome || 'math';
    const predictorVar = state.currentPredictor || 'escs';
    const weightType = state.weightType || 'student';

    if (data.length > 0 && window.runPooledOLS) {
        try {
            // Run regressions to get fresh results
            const ols = window.runPooledOLS(data, outcomeVar, predictorVar, [], weightType);

            if (ols && ols.coefficients) {
                const predLabel = predictorVar === 'escs' ? 'SES (ESCS)' : 'Parental Education';

                html += `
                    <div class="results-table-container">
                        <h3>OLS Regression Results</h3>
                        <table class="results-table">
                            <thead>
                                <tr>
                                    <th>Variable</th>
                                    <th>Coefficient</th>
                                    <th>Std. Error</th>
                                    <th>t-statistic</th>
                                    <th>p-value</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Intercept</td>
                                    <td>${ols.coefficients[0].toFixed(3)}</td>
                                    <td>${ols.standardErrors[0].toFixed(3)}</td>
                                    <td>${ols.tStats[0].toFixed(3)}</td>
                                    <td>${ols.pValues[0] < 0.001 ? '<0.001' : ols.pValues[0].toFixed(3)}</td>
                                </tr>
                                <tr>
                                    <td><strong>${predLabel}</strong></td>
                                    <td><strong>${ols.coefficients[1].toFixed(3)}</strong></td>
                                    <td>${ols.standardErrors[1].toFixed(3)}</td>
                                    <td><strong>${ols.tStats[1].toFixed(3)}</strong></td>
                                    <td><strong>${ols.pValues[1] < 0.001 ? '<0.001' : ols.pValues[1].toFixed(3)}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                        <p style="margin-top: 1rem; font-size: 0.9em;">
                            <strong>Model Fit:</strong> R² = ${(ols.r2 * 100).toFixed(2)}% |
                            N = ${ols.nobs.toLocaleString()} |
                            F-statistic = ${ols.fStatistic ? ols.fStatistic.toFixed(2) : 'N/A'}
                        </p>
                    </div>
                `;

                // Interpretation
                const gradient = ols.coefficients[1];
                const isSignificant = ols.pValues[1] < 0.05;

                html += `
                    <div class="alert alert-info" style="margin-top: 1.5rem;">
                        <strong>Interpretation:</strong> ${isSignificant ? 'A statistically significant' : 'An'} positive relationship exists between ${predLabel.toLowerCase()} and achievement.
                        On average, a one-unit increase in ${predLabel.toLowerCase()} is associated with a ${Math.abs(gradient).toFixed(2)}-point ${gradient > 0 ? 'increase' : 'decrease'} in ${outcomeVar} scores${isSignificant ? ' (p < 0.05)' : ''}.
                        The model explains ${(ols.r2 * 100).toFixed(1)}% of the variance in achievement.
                    </div>
                `;
            } else {
                html += `<p class="alert alert-info">Detailed regression results available in CSV export format.</p>`;
            }
        } catch (error) {
            console.warn('Could not calculate regression for report:', error);
            html += `<p class="alert alert-info">Detailed regression results available in CSV export format.</p>`;
        }
    } else {
        html += `<p class="alert alert-info">Detailed regression results available in CSV export format.</p>`;
    }

    return html;
}

/**
 * Build variance decomposition section
 */
function buildVarianceDecomposition(results) {
    return `
        <h2>6. Variance Decomposition</h2>
        <p>Partitioning of total achievement variance into within-country and between-country components.</p>
        <p class="alert alert-info">Variance decomposition chart included in visualizations section below.</p>
    `;
}

/**
 * Build comparative analysis section
 */
function buildComparativeAnalysis(results) {
    const comp = results.comparative;
    if (!comp) return '';

    return `
        <h2>7. Comparative Analysis</h2>
        <p>Country-level statistics for selected years.</p>
        <p class="alert alert-info">Full comparative statistics available in CSV export format.</p>
    `;
}

/**
 * Build charts section with embedded images
 */
function buildChartsSection(charts) {
    let html = `
        <div class="page-break"></div>
        <h2>8. Visualizations</h2>
        <p>All charts and plots generated during the analysis. Charts are included regardless of which visualizations were selected in the interactive interface.</p>
    `;

    const chartTitles = {
        // Overview & Distribution
        'overview-chart': 'Achievement and Stratification Overview',
        'distribution-chart': 'Score Distribution by Country',
        'percentile-chart': 'Achievement Percentiles',
        'lorenz-curve': 'Lorenz Curve (Inequality)',
        // Achievement Gap
        'gap-plot': 'Achievement Gap by SES Quartiles',
        // Regression
        'regression-scatter': 'Scatter Plot with Fitted Regression Lines',
        'coefficient-plot': 'Regression Coefficient Comparison',
        // Diagnostics
        'residual-plot-ols': 'Residual Plot (OLS)',
        'residual-plot-fe': 'Residual Plot (Fixed Effects)',
        'residual-plot-re': 'Residual Plot (Random Effects)',
        'qq-plot-ols': 'Q-Q Plot (OLS)',
        'qq-plot-fe': 'Q-Q Plot (Fixed Effects)',
        'qq-plot-re': 'Q-Q Plot (Random Effects)',
        'decomposition-chart': 'Variance Decomposition',
        // Comparative
        'world-map': 'Global Intergenerational Educational Stratification Map',
        'temporal-trends': 'Temporal Trends in SES Gradients',
        'country-comparison': 'Cross-National Achievement Comparison',
        'gap-comparison': 'Cross-National Gap Comparison'
    };

    Object.keys(charts).forEach(chartId => {
        const base64 = charts[chartId];
        const title = chartTitles[chartId] || chartId;

        html += `
            <div class="chart-container">
                <h3>${title}</h3>
                <img src="${base64}" alt="${title}" />
            </div>
        `;
    });

    if (Object.keys(charts).length === 0) {
        html += `<p style="color: #888; font-style: italic;">No charts were rendered. Please ensure you navigate through all tabs and render visualizations before generating the report.</p>`;
    }

    return html;
}

/**
 * Build methodology section
 */
function buildMethodologySection() {
    return `
        <div class="page-break"></div>
        <h2>9. Methodology</h2>
        <div class="methodology">
            <h3>Data Source</h3>
            <p>OECD Programme for International Student Assessment (PISA), accessed via the learningtower R package (Vaughan et al., 2021).</p>

            <h3>Statistical Methods</h3>
            <ul>
                <li><strong>Weighted Statistics:</strong> All analyses use student sampling weights (W_FSTUWT) following OECD (2023) technical standards.</li>
                <li><strong>Gini Coefficient:</strong> Measures inequality in achievement distribution (0 = perfect equality, 1 = maximum inequality).</li>
                <li><strong>SES Gradient:</strong> Regression slope of achievement on ESCS index, indicating score points gained per unit increase in socioeconomic status.</li>
                <li><strong>Variance Decomposition:</strong> Partitioning of total variance into within-country and between-country components using intraclass correlation (ICC).</li>
            </ul>

            <h3>Assumptions & Limitations</h3>
            <ul>
                <li>Cross-sectional design precludes causal inference</li>
                <li>Missing data handled via listwise deletion</li>
                <li>Sampling weights account for complex survey design</li>
                <li>Results represent participating countries only</li>
            </ul>
        </div>
    `;
}

/**
 * Build citation section
 */
function buildCitationSection() {
    return `
        <h2>10. How to Cite</h2>
        <div class="citation">
            <h3>This Tool</h3>
            <p>Schoenholzer, K. (2025). <em>Educational Inequality Data Explorer</em> [Web application]. https://kevinschoenholzer.com/pisa/</p>

            <h3>Data Source</h3>
            <p>OECD (2023). <em>PISA Database</em>. Organisation for Economic Co-operation and Development. https://www.oecd.org/pisa/data/</p>

            <h3>R Package</h3>
            <p>Vaughan, B., Stanke, L., Teng, T., Hyndman, R., & O'Hara-Wild, E. (2021). <em>learningtower: OECD PISA Datasets from 2000-2018 in an Easy-to-Use Format</em>. R package version 1.0.1.</p>

            <h3>Key References</h3>
            <ul>
                <li>OECD (2019). <em>PISA 2018 Technical Report</em>. OECD Publishing.</li>
                <li>Reardon, S. F. (2011). The widening academic achievement gap between the rich and the poor: New evidence and possible explanations. In R. Murnane & G. Duncan (Eds.), <em>Whither Opportunity?</em> (pp. 91–116). Russell Sage Foundation.</li>
            </ul>
        </div>
    `;
}

/**
 * Build footer
 */
function buildFooter() {
    return `
        <div class="footer">
            <p>Educational Inequality Data Explorer | Generated with Claude Code</p>
            <p>Kevin Schoenholzer © 2025</p>
            <p style="margin-top: 1rem; font-size: 0.75rem;">
                This report was generated automatically from the PISA Educational Inequality Data Explorer.<br>
                For interactive analysis, visit: https://kevinschoenholzer.com/pisa/
            </p>
        </div>
    `;
}

/**
 * Download HTML content as file
 */
function downloadHTML(htmlContent, filename) {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');

    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

export default {
    generateFullReport
};
