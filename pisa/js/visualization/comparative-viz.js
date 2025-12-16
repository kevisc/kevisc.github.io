/**
 * Comparative Analysis Visualization Module
 * Renders cross-country and cross-year comparisons
 * Author: Kevin Schoenholzer
 * Date: 2025-12-16
 */

import { calculateVarianceDecomposition } from '../analysis/decomposition.js';

/**
 * Render country comparison chart
 * @param {Object} comparativeResults - Results by country and year
 * @param {Array} years - Array of years to compare
 */
export function renderCountryComparison(comparativeResults, years) {
    if (!comparativeResults || Object.keys(comparativeResults).length === 0) {
        return;
    }

    const countries = Object.keys(comparativeResults);
    const traces = [];

    years.forEach(year => {
        const means = [];
        const countryNames = [];

        countries.forEach(country => {
            if (comparativeResults[country] && comparativeResults[country][year]) {
                means.push(comparativeResults[country][year].mean);
                countryNames.push(country);
            }
        });

        if (means.length > 0) {
            traces.push({
                x: countryNames,
                y: means,
                name: `Year ${year}`,
                type: 'bar'
            });
        }
    });

    const layout = {
        title: 'Cross-National Comparison: Achievement Trends',
        xaxis: {
            title: 'Country',
            gridcolor: '#334155'
        },
        yaxis: {
            title: 'Mean Achievement Score',
            gridcolor: '#334155'
        },
        paper_bgcolor: '#1e293b',
        plot_bgcolor: '#1e293b',
        font: { color: '#f1f5f9' },
        barmode: 'group',
        showlegend: true
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    const chartDiv = document.getElementById('country-comparison');
    if (chartDiv) {
        Plotly.newPlot(chartDiv, traces, layout, config);
    }
}

/**
 * Render variance decomposition chart
 * @param {Array} data - Array of student records
 * @param {String} outcomeVar - Name of outcome variable
 */
export function renderDecompositionChart(data, outcomeVar = 'math') {
    if (!data || data.length === 0) {
        return;
    }

    const countries = [...new Set(data.map(d => d.country))];
    const decomp = calculateVarianceDecomposition(data, outcomeVar, countries);

    if (!decomp) {
        return;
    }

    const components = ['Within-country', 'Between-country'];
    const values = [decomp.percentWithin, decomp.percentBetween];

    const trace = {
        x: components,
        y: values,
        type: 'bar',
        marker: {
            color: ['#3b82f6', '#10b981']
        },
        text: values.map(v => `${v.toFixed(1)}%`),
        textposition: 'outside'
    };

    const layout = {
        title: 'Variance Decomposition of Achievement',
        xaxis: {
            title: '',
            gridcolor: '#334155'
        },
        yaxis: {
            title: 'Percent of Total Variance',
            range: [0, 100],
            gridcolor: '#334155'
        },
        paper_bgcolor: '#1e293b',
        plot_bgcolor: '#1e293b',
        font: { color: '#f1f5f9' },
        showlegend: false,
        annotations: [{
            x: 0.5,
            y: -0.15,
            xref: 'paper',
            yref: 'paper',
            text: `ICC = ${decomp.icc.toFixed(3)} (ρ)`,
            showarrow: false,
            font: { size: 14 }
        }]
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    const chartDiv = document.getElementById('decomposition-chart');
    if (chartDiv) {
        Plotly.newPlot(chartDiv, [trace], layout, config);
    }
}

/**
 * Render gap comparison across countries
 * @param {Object} gapResults - Gap results by country
 */
export function renderGapComparison(gapResults) {
    if (!gapResults || Object.keys(gapResults).length === 0) {
        return;
    }

    const countries = Object.keys(gapResults).filter(c =>
        gapResults[c] && isFinite(gapResults[c].gap_q4_q1)
    );

    countries.sort((a, b) => gapResults[a].gap_q4_q1 - gapResults[b].gap_q4_q1);

    const gaps = countries.map(c => gapResults[c].gap_q4_q1);
    const effectSizes = countries.map(c => gapResults[c].effect_size);

    const trace1 = {
        x: countries,
        y: gaps,
        name: 'Gap (Q4-Q1)',
        type: 'bar',
        yaxis: 'y',
        marker: { color: '#3b82f6' }
    };

    const trace2 = {
        x: countries,
        y: effectSizes,
        name: 'Effect Size (d)',
        type: 'scatter',
        mode: 'markers+lines',
        yaxis: 'y2',
        marker: {
            size: 10,
            color: '#ef4444'
        },
        line: {
            color: '#ef4444',
            width: 2
        }
    };

    const layout = {
        title: 'Achievement Gap Comparison (Q4-Q1 SES Quartiles)',
        xaxis: {
            title: 'Country',
            gridcolor: '#334155'
        },
        yaxis: {
            title: 'Achievement Gap (score points)',
            gridcolor: '#334155'
        },
        yaxis2: {
            title: 'Effect Size (Cohen\'s d)',
            overlaying: 'y',
            side: 'right',
            gridcolor: 'transparent'
        },
        paper_bgcolor: '#1e293b',
        plot_bgcolor: '#1e293b',
        font: { color: '#f1f5f9' },
        showlegend: true,
        legend: {
            x: 0,
            y: 1
        }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    const chartDiv = document.getElementById('gap-comparison');
    if (chartDiv) {
        Plotly.newPlot(chartDiv, [trace1, trace2], layout, config);
    }
}

/**
 * Render all comparative charts
 * @param {Array} data - Array of student records
 * @param {Object} comparativeResults - Comparative analysis results
 * @param {String} outcomeVar - Name of outcome variable
 */
export function renderAllComparativeCharts(data, comparativeResults, outcomeVar = 'math') {
    const years = [...new Set(data.map(d => d.year))].sort();
    renderCountryComparison(comparativeResults, years);
    renderDecompositionChart(data, outcomeVar);
}

export default {
    renderCountryComparison,
    renderDecompositionChart,
    renderGapComparison,
    renderAllComparativeCharts
};
