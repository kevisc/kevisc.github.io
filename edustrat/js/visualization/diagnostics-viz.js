/**
 * Diagnostics Visualization Module
 * Renders model diagnostics, assumption checks, and statistical tests
 * Author: Kevin Schoenholzer
 * Date: 2026-01-10
 */

/**
 * Create model comparison summary table
 * @param {Object} models - Object containing OLS, FE, RE models
 * @returns {String} HTML table
 */
export function createDiagnosticsComparisonTable(models) {
    if (!models || Object.keys(models).length === 0) {
        return '<p class="text-secondary">No models available. Run regression analysis first.</p>';
    }

    const ols = models.ols;
    const fe = models.fixedEffects;
    const re = models.randomEffects;

    let html = `
        <div class="model-box">
            <div class="model-header">Model Comparison Summary</div>
            <table class="coef-table">
                <thead>
                    <tr>
                        <th>Statistic</th>
                        <th>OLS (Pooled)</th>
                        <th>Fixed Effects</th>
                        <th>Random Effects</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Sample Size (N)</strong></td>
                        <td>${ols?.nobs?.toLocaleString() || '—'}</td>
                        <td>${fe?.nobs?.toLocaleString() || '—'}</td>
                        <td>${re?.nobs?.toLocaleString() || '—'}</td>
                    </tr>
                    <tr>
                        <td><strong>Number of Groups</strong></td>
                        <td>—</td>
                        <td>${fe?.ngroups || '—'}</td>
                        <td>${re?.ngroups || '—'}</td>
                    </tr>
                    <tr>
                        <td><strong>R² (Overall)</strong></td>
                        <td>${ols?.r2 !== undefined ? ols.r2.toFixed(4) : '—'}</td>
                        <td>${fe?.r2 !== undefined ? fe.r2.toFixed(4) : '—'}</td>
                        <td>${re?.r2 !== undefined ? re.r2.toFixed(4) : '—'}</td>
                    </tr>
                    <tr>
                        <td><strong>R² (Within)</strong></td>
                        <td>—</td>
                        <td>${fe?.r2Within !== undefined ? fe.r2Within.toFixed(4) : '—'}</td>
                        <td>${re?.r2Within !== undefined ? re.r2Within.toFixed(4) : '—'}</td>
                    </tr>
                    <tr>
                        <td><strong>R² (Between)</strong></td>
                        <td>—</td>
                        <td>${fe?.r2Between !== undefined ? fe.r2Between.toFixed(4) : '—'}</td>
                        <td>${re?.r2Between !== undefined ? re.r2Between.toFixed(4) : '—'}</td>
                    </tr>
                    <tr>
                        <td><strong>Adjusted R²</strong></td>
                        <td>${ols?.adjR2 !== undefined ? ols.adjR2.toFixed(4) : '—'}</td>
                        <td>${fe?.adjR2 !== undefined ? fe.adjR2.toFixed(4) : '—'}</td>
                        <td>${re?.adjR2 !== undefined ? re.adjR2.toFixed(4) : '—'}</td>
                    </tr>
                    <tr>
                        <td><strong>AIC</strong></td>
                        <td>${ols?.aic !== undefined ? ols.aic.toFixed(1) : '—'}</td>
                        <td>${fe?.aic !== undefined ? fe.aic.toFixed(1) : '—'}</td>
                        <td>${re?.aic !== undefined ? re.aic.toFixed(1) : '—'}</td>
                    </tr>
                    <tr>
                        <td><strong>BIC</strong></td>
                        <td>${ols?.bic !== undefined ? ols.bic.toFixed(1) : '—'}</td>
                        <td>${fe?.bic !== undefined ? fe.bic.toFixed(1) : '—'}</td>
                        <td>${re?.bic !== undefined ? re.bic.toFixed(1) : '—'}</td>
                    </tr>
                    <tr>
                        <td><strong>ICC (ρ)</strong></td>
                        <td>—</td>
                        <td>${fe?.rho !== undefined ? fe.rho.toFixed(4) : '—'}</td>
                        <td>${re?.rho !== undefined ? re.rho.toFixed(4) : '—'}</td>
                    </tr>
                </tbody>
            </table>
            <div class="methodology-note" style="margin-top: 1rem;">
                <strong>Interpretation:</strong> Lower AIC/BIC = better fit. Higher R² = more variance explained.
                ICC (ρ) shows proportion of variance at group level. R² within measures explanatory power for within-group variation.
            </div>
        </div>
    `;

    return html;
}

/**
 * Create Hausman test panel
 * @param {Object} hausmanResult - Hausman test results
 * @returns {String} HTML panel
 */
export function createHausmanTestPanel(hausmanResult) {
    if (!hausmanResult) {
        return `
            <div class="model-box">
                <div class="model-header">Hausman Specification Test</div>
                <p class="text-secondary">Hausman test not available. Both Fixed Effects and Random Effects models are required.</p>
            </div>
        `;
    }

    const isSignificant = hausmanResult.pValue < 0.05;
    const statusColor = isSignificant ? '#ef4444' : '#10b981';
    const statusIcon = isSignificant ? '⚠️' : '✓';
    const recommendation = isSignificant ? 'Fixed Effects' : 'Random Effects';

    return `
        <div class="model-box">
            <div class="model-header">Hausman Specification Test</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1rem;">
                <div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Chi-squared (df=1)</div>
                    <div style="font-size: 1.5rem; font-weight: 600;">${hausmanResult.chiSquared.toFixed(3)}</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.25rem;">P-value</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: ${statusColor};">${hausmanResult.pValue.toFixed(4)}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1rem;">
                <div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.25rem;">FE Coefficient</div>
                    <div style="font-size: 1.2rem;">${hausmanResult.bFE?.toFixed(3) || '—'}</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.25rem;">RE Coefficient</div>
                    <div style="font-size: 1.2rem;">${hausmanResult.bRE?.toFixed(3) || '—'}</div>
                </div>
            </div>
            <div style="background: ${statusColor}22; border-left: 4px solid ${statusColor}; padding: 1rem; border-radius: 0 4px 4px 0;">
                <div style="font-weight: 600; margin-bottom: 0.5rem;">${statusIcon} Recommendation: Use ${recommendation}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    ${isSignificant
                        ? 'The test rejects the null hypothesis (p < 0.05). Systematic differences exist between FE and RE coefficients, suggesting correlation between group effects and predictors. Fixed Effects is preferred.'
                        : 'The test fails to reject the null hypothesis (p ≥ 0.05). No systematic differences detected between FE and RE coefficients. Random Effects is more efficient and acceptable.'}
                </div>
            </div>
        </div>
    `;
}

/**
 * Create residual summary statistics cards
 * @param {Object} models - Object containing models with residuals
 * @returns {String} HTML cards
 */
export function createResidualSummaryCards(models) {
    if (!models || Object.keys(models).length === 0) {
        return '';
    }

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">';

    const modelList = [
        { key: 'ols', name: 'OLS (Pooled)' },
        { key: 'fixedEffects', name: 'Fixed Effects' },
        { key: 'randomEffects', name: 'Random Effects' }
    ];

    modelList.forEach(({ key, name }) => {
        const model = models[key];
        if (!model || !model.residuals) return;

        const residuals = model.residuals.filter(Number.isFinite);
        if (residuals.length === 0) return;

        const n = residuals.length;
        const mean = residuals.reduce((a, b) => a + b, 0) / n;
        const variance = residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n;
        const sd = Math.sqrt(variance);
        const min = Math.min(...residuals);
        const max = Math.max(...residuals);

        // Count outliers (|residual| > 3 SD)
        const outliers = residuals.filter(r => Math.abs(r - mean) > 3 * sd);
        const outlierPct = (outliers.length / n * 100).toFixed(2);

        // Assess normality qualitatively
        const skewness = residuals.reduce((sum, r) => sum + Math.pow((r - mean) / sd, 3), 0) / n;
        const kurtosis = residuals.reduce((sum, r) => sum + Math.pow((r - mean) / sd, 4), 0) / n - 3;

        let normalityStatus = 'Good';
        let normalityColor = '#10b981';
        if (Math.abs(skewness) > 1 || Math.abs(kurtosis) > 2) {
            normalityStatus = 'Moderate concern';
            normalityColor = '#f59e0b';
        }
        if (Math.abs(skewness) > 2 || Math.abs(kurtosis) > 7) {
            normalityStatus = 'Significant departure';
            normalityColor = '#ef4444';
        }

        html += `
            <div class="model-box" style="padding: 1rem;">
                <div style="font-weight: 600; margin-bottom: 0.75rem; color: var(--primary-color);">${name}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;">
                    <div>Mean:</div><div style="text-align: right;">${mean.toFixed(3)}</div>
                    <div>Std. Dev:</div><div style="text-align: right;">${sd.toFixed(3)}</div>
                    <div>Min:</div><div style="text-align: right;">${min.toFixed(1)}</div>
                    <div>Max:</div><div style="text-align: right;">${max.toFixed(1)}</div>
                    <div>Skewness:</div><div style="text-align: right;">${skewness.toFixed(3)}</div>
                    <div>Excess Kurtosis:</div><div style="text-align: right;">${kurtosis.toFixed(3)}</div>
                    <div>Outliers (>3σ):</div><div style="text-align: right;">${outliers.length} (${outlierPct}%)</div>
                </div>
                <div style="margin-top: 0.75rem; padding: 0.5rem; background: ${normalityColor}22; border-radius: 4px; font-size: 0.85rem;">
                    <span style="color: ${normalityColor};">●</span> Normality: ${normalityStatus}
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

/**
 * Create assumption check dashboard
 * @param {Object} models - Models object
 * @param {Object} hausmanResult - Hausman test result
 * @returns {String} HTML dashboard
 */
export function createAssumptionCheckDashboard(models, hausmanResult) {
    const checks = [];

    // 1. Linearity check (based on residual mean near zero)
    const ols = models?.ols;
    if (ols?.residuals) {
        const residuals = ols.residuals.filter(Number.isFinite);
        const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
        const status = Math.abs(mean) < 1 ? 'pass' : Math.abs(mean) < 5 ? 'warning' : 'fail';
        checks.push({
            name: 'Linearity',
            status,
            detail: `Residual mean: ${mean.toFixed(3)} (should be ≈ 0)`
        });
    }

    // 2. Normality check (based on skewness/kurtosis)
    if (ols?.residuals) {
        const residuals = ols.residuals.filter(Number.isFinite);
        const n = residuals.length;
        const mean = residuals.reduce((a, b) => a + b, 0) / n;
        const sd = Math.sqrt(residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n);
        const skewness = residuals.reduce((sum, r) => sum + Math.pow((r - mean) / sd, 3), 0) / n;
        const kurtosis = residuals.reduce((sum, r) => sum + Math.pow((r - mean) / sd, 4), 0) / n - 3;

        const status = (Math.abs(skewness) < 1 && Math.abs(kurtosis) < 2) ? 'pass'
            : (Math.abs(skewness) < 2 && Math.abs(kurtosis) < 7) ? 'warning' : 'fail';
        checks.push({
            name: 'Normality',
            status,
            detail: `Skew: ${skewness.toFixed(2)}, Kurtosis: ${kurtosis.toFixed(2)}`
        });
    }

    // 3. Homoscedasticity (qualitative - based on residual spread)
    if (ols?.residuals && ols?.yhat) {
        // Simple check: compare SD of residuals in lower vs upper half of fitted values
        const pairs = ols.yhat.map((y, i) => ({ yhat: y, resid: ols.residuals[i] }))
            .filter(p => Number.isFinite(p.yhat) && Number.isFinite(p.resid))
            .sort((a, b) => a.yhat - b.yhat);

        const mid = Math.floor(pairs.length / 2);
        const lowerHalf = pairs.slice(0, mid).map(p => p.resid);
        const upperHalf = pairs.slice(mid).map(p => p.resid);

        const sdLower = Math.sqrt(lowerHalf.reduce((s, r) => s + r * r, 0) / lowerHalf.length);
        const sdUpper = Math.sqrt(upperHalf.reduce((s, r) => s + r * r, 0) / upperHalf.length);
        const ratio = Math.max(sdLower, sdUpper) / Math.min(sdLower, sdUpper);

        const status = ratio < 1.5 ? 'pass' : ratio < 2 ? 'warning' : 'fail';
        checks.push({
            name: 'Homoscedasticity',
            status,
            detail: `Variance ratio (upper/lower): ${ratio.toFixed(2)}`
        });
    }

    // 4. Model specification (Hausman test)
    if (hausmanResult) {
        const status = hausmanResult.pValue >= 0.05 ? 'pass' : 'warning';
        checks.push({
            name: 'Model Specification',
            status,
            detail: hausmanResult.pValue < 0.05
                ? 'FE preferred (p < 0.05)'
                : 'RE acceptable (p ≥ 0.05)'
        });
    }

    // 5. Sample size adequacy
    if (ols?.nobs) {
        const k = ols.variableNames?.length || 2;
        const ratio = ols.nobs / k;
        const status = ratio > 50 ? 'pass' : ratio > 20 ? 'warning' : 'fail';
        checks.push({
            name: 'Sample Size',
            status,
            detail: `N/k ratio: ${ratio.toFixed(0)} (N=${ols.nobs.toLocaleString()}, k=${k})`
        });
    }

    const statusColors = {
        pass: '#10b981',
        warning: '#f59e0b',
        fail: '#ef4444'
    };

    const statusIcons = {
        pass: '✓',
        warning: '⚠',
        fail: '✗'
    };

    let html = `
        <div class="model-box">
            <div class="model-header">Assumption Check Summary</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
    `;

    checks.forEach(check => {
        html += `
            <div style="padding: 1rem; background: ${statusColors[check.status]}15; border-radius: 8px; border: 1px solid ${statusColors[check.status]}40;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="color: ${statusColors[check.status]}; font-size: 1.2rem;">${statusIcons[check.status]}</span>
                    <span style="font-weight: 600;">${check.name}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${check.detail}</div>
            </div>
        `;
    });

    html += `
            </div>
            <div class="methodology-note" style="margin-top: 1rem;">
                <strong>Legend:</strong>
                <span style="color: #10b981;">✓ Pass</span> — assumption met;
                <span style="color: #f59e0b;">⚠ Warning</span> — minor concerns;
                <span style="color: #ef4444;">✗ Fail</span> — significant violation
            </div>
        </div>
    `;

    return html;
}

/**
 * Render residuals histogram
 * @param {Object} model - Model with residuals
 * @param {String} modelName - Display name
 * @param {String} targetElementId - Target div ID
 */
export function renderResidualsHistogram(model, modelName, targetElementId) {
    if (!model || !model.residuals) {
        console.warn('Cannot render histogram: missing residuals');
        return;
    }

    const residuals = model.residuals.filter(Number.isFinite);
    if (residuals.length < 10) {
        console.warn('Cannot render histogram: insufficient residuals');
        return;
    }

    // Calculate statistics for overlay
    const n = residuals.length;
    const mean = residuals.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n);

    const trace = {
        x: residuals,
        type: 'histogram',
        name: 'Residuals',
        marker: {
            color: '#3b82f6',
            opacity: 0.7,
            line: {
                color: '#1e40af',
                width: 1
            }
        },
        nbinsx: 50
    };

    // Generate normal curve overlay
    const xMin = Math.min(...residuals);
    const xMax = Math.max(...residuals);
    const xRange = [];
    const yNormal = [];
    const step = (xMax - xMin) / 100;
    const binWidth = (xMax - xMin) / 50;

    for (let x = xMin; x <= xMax; x += step) {
        xRange.push(x);
        const z = (x - mean) / sd;
        const density = Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
        yNormal.push(density * n * binWidth);
    }

    const normalCurve = {
        x: xRange,
        y: yNormal,
        type: 'scatter',
        mode: 'lines',
        name: 'Normal',
        line: {
            color: '#ef4444',
            width: 2
        }
    };

    const layout = {
        title: {
            text: `Residual Distribution: ${modelName}`,
            font: { color: '#f1f5f9', size: 14 }
        },
        xaxis: {
            title: 'Residuals',
            gridcolor: '#334155'
        },
        yaxis: {
            title: 'Frequency',
            gridcolor: '#334155'
        },
        paper_bgcolor: '#1e293b',
        plot_bgcolor: '#1e293b',
        font: { color: '#f1f5f9' },
        showlegend: true,
        legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: 'rgba(30, 41, 59, 0.8)'
        },
        bargap: 0.05,
        margin: { t: 50, b: 60, l: 60, r: 30 }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    const chartDiv = document.getElementById(targetElementId);
    if (chartDiv) {
        Plotly.newPlot(chartDiv, [trace, normalCurve], layout, config);
    }
}

/**
 * Render Cook's Distance plot
 * @param {Object} model - Model with residuals
 * @param {String} modelName - Display name
 * @param {String} targetElementId - Target div ID
 */
export function renderCooksDistancePlot(model, modelName, targetElementId) {
    if (!model || !model.residuals) {
        console.warn('Cannot render Cook\'s distance: missing residuals');
        return;
    }

    const residuals = model.residuals.filter(Number.isFinite);
    const n = residuals.length;
    const k = model.variableNames?.length || 2;

    // Calculate Cook's Distance (simplified approximation)
    const mean = residuals.reduce((a, b) => a + b, 0) / n;
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / (n - k);
    const avgLeverage = k / n;

    const cooksD = residuals.map(r => {
        const h = avgLeverage; // Simplified: using average leverage
        return (r * r / (k * mse)) * (h / Math.pow(1 - h, 2));
    });

    const threshold = 4 / n;
    const influential = cooksD.filter(d => d > threshold).length;

    // Create indices for x-axis
    const indices = cooksD.map((_, i) => i + 1);

    // Color points by whether they exceed threshold
    const colors = cooksD.map(d => d > threshold ? '#ef4444' : '#3b82f6');

    const trace = {
        x: indices,
        y: cooksD,
        type: 'scatter',
        mode: 'markers',
        name: "Cook's D",
        marker: {
            size: 4,
            color: colors,
            opacity: 0.6
        }
    };

    // Threshold line
    const thresholdLine = {
        x: [1, n],
        y: [threshold, threshold],
        type: 'scatter',
        mode: 'lines',
        name: `Threshold (4/n = ${threshold.toFixed(4)})`,
        line: {
            color: '#f59e0b',
            width: 2,
            dash: 'dash'
        }
    };

    const layout = {
        title: {
            text: `Cook's Distance: ${modelName} (${influential} influential points)`,
            font: { color: '#f1f5f9', size: 14 }
        },
        xaxis: {
            title: 'Observation Index',
            gridcolor: '#334155'
        },
        yaxis: {
            title: "Cook's Distance",
            gridcolor: '#334155'
        },
        paper_bgcolor: '#1e293b',
        plot_bgcolor: '#1e293b',
        font: { color: '#f1f5f9' },
        showlegend: true,
        legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: 'rgba(30, 41, 59, 0.8)'
        },
        margin: { t: 50, b: 60, l: 60, r: 30 }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    const chartDiv = document.getElementById(targetElementId);
    if (chartDiv) {
        Plotly.newPlot(chartDiv, [trace, thresholdLine], layout, config);
    }
}

/**
 * Render Scale-Location plot (sqrt of standardized residuals vs fitted)
 * @param {Object} model - Model with residuals and fitted values
 * @param {String} modelName - Display name
 * @param {String} targetElementId - Target div ID
 */
export function renderScaleLocationPlot(model, modelName, targetElementId) {
    if (!model || !model.residuals || !model.yhat) {
        console.warn('Cannot render scale-location plot: missing data');
        return;
    }

    const pairs = [];
    const residuals = model.residuals;
    const n = residuals.length;
    const mean = residuals.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n);

    for (let i = 0; i < model.yhat.length; i++) {
        const fitted = model.yhat[i];
        const residual = model.residuals[i];
        if (Number.isFinite(fitted) && Number.isFinite(residual)) {
            const standardized = (residual - mean) / sd;
            pairs.push([fitted, Math.sqrt(Math.abs(standardized))]);
        }
    }

    if (pairs.length === 0) return;

    // Sample if too many points
    const maxPoints = 3000;
    const step = Math.ceil(pairs.length / maxPoints);
    const fitted = [];
    const sqrtAbsResid = [];
    for (let i = 0; i < pairs.length; i += step) {
        fitted.push(pairs[i][0]);
        sqrtAbsResid.push(pairs[i][1]);
    }

    const trace = {
        x: fitted,
        y: sqrtAbsResid,
        type: 'scatter',
        mode: 'markers',
        name: 'Observations',
        marker: {
            size: 4,
            color: '#3b82f6',
            opacity: 0.5
        }
    };

    // Add smoothed line (simple moving average)
    const sorted = fitted.map((f, i) => ({ x: f, y: sqrtAbsResid[i] })).sort((a, b) => a.x - b.x);
    const windowSize = Math.max(10, Math.floor(sorted.length / 20));
    const smoothX = [];
    const smoothY = [];
    for (let i = windowSize; i < sorted.length - windowSize; i += Math.floor(windowSize / 2)) {
        const window = sorted.slice(i - windowSize, i + windowSize);
        smoothX.push(window.reduce((s, p) => s + p.x, 0) / window.length);
        smoothY.push(window.reduce((s, p) => s + p.y, 0) / window.length);
    }

    const smoothLine = {
        x: smoothX,
        y: smoothY,
        type: 'scatter',
        mode: 'lines',
        name: 'Trend',
        line: {
            color: '#ef4444',
            width: 2
        }
    };

    const layout = {
        title: {
            text: `Scale-Location: ${modelName}`,
            font: { color: '#f1f5f9', size: 14 }
        },
        xaxis: {
            title: 'Fitted Values',
            gridcolor: '#334155'
        },
        yaxis: {
            title: '√|Standardized Residuals|',
            gridcolor: '#334155'
        },
        paper_bgcolor: '#1e293b',
        plot_bgcolor: '#1e293b',
        font: { color: '#f1f5f9' },
        showlegend: true,
        legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: 'rgba(30, 41, 59, 0.8)'
        },
        margin: { t: 50, b: 60, l: 60, r: 30 }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    const chartDiv = document.getElementById(targetElementId);
    if (chartDiv) {
        Plotly.newPlot(chartDiv, [trace, smoothLine], layout, config);
    }
}

export default {
    createDiagnosticsComparisonTable,
    createHausmanTestPanel,
    createResidualSummaryCards,
    createAssumptionCheckDashboard,
    renderResidualsHistogram,
    renderCooksDistancePlot,
    renderScaleLocationPlot
};
