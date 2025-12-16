/**
 * Regression Visualization Module
 * Renders regression results and coefficient plots
 * Author: Kevin Schoenholzer
 * Date: 2025-12-16
 */

/**
 * Render regression results table
 * @param {Object} model - Regression model results
 * @returns {String} HTML table
 */
export function createModelTable(model) {
    if (!model) {
        return '<p>No model results available</p>';
    }

    let html = `
        <div class="model-box">
            <div class="model-header">${model.modelName}</div>
            <div class="methodology-note" style="margin-bottom: 1rem;">
                N = ${model.nobs}${model.ngroups ? `, Groups = ${model.ngroups}` : ''}<br>
                ${model.r2Within !== undefined && !isNaN(model.r2Within) ? `R² (within) = ${model.r2Within.toFixed(3)}<br>` : ''}
                ${model.r2Between !== undefined && !isNaN(model.r2Between) ? `R² (between) = ${model.r2Between.toFixed(3)}<br>` : ''}
                ${model.r2 !== undefined && !isNaN(model.r2) ? `R² ${model.r2Within !== undefined ? '(overall)' : ''} = ${model.r2.toFixed(3)}<br>` : ''}
                ${model.icc !== undefined && !isNaN(model.icc) ? `ICC = ${model.icc.toFixed(3)}<br>` : ''}
                ${model.rho !== undefined && !isNaN(model.rho) ? `ρ = ${model.rho.toFixed(3)}<br>` : ''}
                ${model.weighted ? 'Weighted estimation' : ''}
            </div>
            <table class="coef-table">
                <thead>
                    <tr>
                        <th>Variable</th>
                        <th>Coef.</th>
                        <th>SE</th>
                        <th>p-value</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (model.coefficients && model.variableNames) {
        model.coefficients.forEach((coef, i) => {
            if (model.pValues && model.standardErrors &&
                i < model.pValues.length && i < model.standardErrors.length &&
                i < model.variableNames.length &&
                !isNaN(coef) && !isNaN(model.standardErrors[i]) && !isNaN(model.pValues[i])) {

                const sig = model.pValues[i] < 0.05;
                html += `
                    <tr>
                        <td>${model.variableNames[i]}</td>
                        <td class="${sig ? 'significant' : ''}">${coef.toFixed(2)}</td>
                        <td>${model.standardErrors[i].toFixed(2)}</td>
                        <td>${Math.min(1, Math.max(0, model.pValues[i])).toFixed(4)}</td>
                    </tr>
                `;
            }
        });
    }

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

/**
 * Render regression comparison (multiple models)
 * @param {Object} models - Object containing multiple models
 */
export function renderRegressionComparison(models) {
    if (!models || Object.keys(models).length === 0) {
        return;
    }

    const comparisonDiv = document.getElementById('regression-results');
    if (!comparisonDiv) {
        return;
    }

    let html = '<div class="grid-2" style="gap: 2rem;">';

    Object.values(models).forEach(model => {
        html += createModelTable(model);
    });

    html += '</div>';

    comparisonDiv.innerHTML = html;
}

/**
 * Render coefficient comparison plot
 * @param {Object} models - Object containing multiple models
 * @param {String} predictorName - Name of predictor to plot
 */
export function renderCoefficientPlot(models, predictorName) {
    if (!models || Object.keys(models).length === 0) {
        return;
    }

    const traces = [];

    Object.values(models).forEach(model => {
        if (model && Array.isArray(model.variableNames)) {
            const idx = model.variableNames.findIndex(name => name === predictorName);

            if (idx >= 0 && model.coefficients && model.standardErrors) {
                traces.push({
                    x: [model.modelName],
                    y: [model.coefficients[idx]],
                    error_y: {
                        type: 'data',
                        array: [1.96 * model.standardErrors[idx]],
                        visible: true
                    },
                    type: 'scatter',
                    mode: 'markers',
                    name: model.modelName,
                    marker: { size: 12 }
                });
            }
        }
    });

    if (traces.length === 0) {
        return;
    }

    const layout = {
        title: `${predictorName} Coefficient Across Models (95% CI)`,
        xaxis: {
            title: 'Model',
            gridcolor: '#334155'
        },
        yaxis: {
            title: `${predictorName} Coefficient`,
            gridcolor: '#334155'
        },
        paper_bgcolor: '#1e293b',
        plot_bgcolor: '#1e293b',
        font: { color: '#f1f5f9' },
        showlegend: false,
        hovermode: 'closest'
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    const chartDiv = document.getElementById('regression-plot');
    if (chartDiv) {
        Plotly.newPlot(chartDiv, traces, layout, config);
    }
}

/**
 * Render Hausman test results
 * @param {Object} hausmanTest - Hausman test results
 */
export function renderHausmanTest(hausmanTest) {
    if (!hausmanTest) {
        return;
    }

    const hausmanDiv = document.getElementById('hausman-test');
    if (!hausmanDiv) {
        return;
    }

    const chiSq = !isNaN(hausmanTest.chiSquared) ? hausmanTest.chiSquared.toFixed(2) : 'N/A';
    const pVal = !isNaN(hausmanTest.pValue) ? hausmanTest.pValue.toFixed(4) : 'N/A';

    hausmanDiv.innerHTML = `
        <div class="methodology-note">
            <strong>Hausman Specification Test</strong><br>
            H₀: Difference in coefficients not systematic<br>
            χ²(${hausmanTest.df}) = ${chiSq}<br>
            p-value = ${pVal}<br>
            <strong>Conclusion:</strong> ${hausmanTest.conclusion}
        </div>
    `;
}

export default {
    createModelTable,
    renderRegressionComparison,
    renderCoefficientPlot,
    renderHausmanTest
};
