# Educational Inequality Explorer - Version 2 Update Summary

## ✅ Completed Updates

### 1. Full CSV Export Script Created
**File:** `export_full_csv.R`
- Exports complete dataset as CSV (~1GB)
- Suitable for R/Python analysis
- **Run to generate:** `source("export_full_csv.R")`

### 2. Scientific Methods Document Created
**File:** `Methods_Document.md` and `Methods_Document.html`
- Comprehensive 14-section methodological documentation
- Includes all formulas, procedures, interpretation guidelines
- Academic-quality documentation ready for download

### 3. HTML Application - Completed Updates
**File:** `educational_inequality_explorer_v2.html`

#### What's Been Updated:
- ✅ Added "Diagnostics" tab to navigation
- ✅ Replaced methodology page with short description + download button for methods document
- ✅ Created diagnostics tab structure with within/between/pooled analysis options

## ⚠️ Remaining Tasks

Due to the complex interdependencies in a 2500+ line HTML file, the following updates require careful manual integration. Below are ready-to-use code sections for each update.

### Task 1: Update Country Selection to Checkboxes

**Current Code (lines ~560-566):**
```html
<div class="control-group">
    <label for="countries">Countries</label>
    <select id="countries" multiple style="height: 200px;">
        <!-- Countries will be populated from loaded data -->
    </select>
    <div class="weight-info" id="country-count">Load data file to see available countries</div>
</div>
```

**Replace With:**
```html
<div class="control-group">
    <label for="countries">Countries</label>
    <div style="margin-bottom: 0.5rem;">
        <button onclick="selectAllCountries()" style="padding: 0.4rem 0.8rem; margin-right: 0.5rem; font-size: 0.85rem; cursor: pointer;">Select All</button>
        <button onclick="deselectAllCountries()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; cursor: pointer;">Deselect All</button>
    </div>
    <div id="country-checkboxes" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border); padding: 0.75rem; border-radius: 4px; background: white;">
        <!-- Checkboxes will be populated dynamically -->
    </div>
    <div class="weight-info" id="countries-selected-count">No countries selected</div>
</div>
```

### Task 2: Update Year Selection to Checkboxes

**Current Code (lines ~555-558):**
```html
<div class="year-selector" id="year-selector">
    <!-- Years populated from loaded data -->
</div>
```

**Replace With:**
```html
<div class="control-group">
    <label>Years</label>
    <div style="margin-bottom: 0.5rem;">
        <button onclick="selectAllYears()" style="padding: 0.4rem 0.8rem; margin-right: 0.5rem; font-size: 0.85rem; cursor: pointer;">Select All</button>
        <button onclick="deselectAllYears()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; cursor: pointer;">Deselect All</button>
    </div>
    <div id="year-checkboxes" style="display: flex; gap: 1rem; flex-wrap: wrap; padding: 0.75rem; border: 1px solid var(--border); border-radius: 4px; background: white;">
        <!-- Year checkboxes will be populated dynamically -->
    </div>
    <div class="weight-info" id="years-selected-count">No years selected</div>
</div>
```

### Task 3: Add Within/Across Years Analysis Option

**Add After Year Selection:**
```html
<div class="control-group">
    <label>Temporal Analysis</label>
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="radio" name="year-analysis-type" value="within" checked>
            <span>Within Years (separate analysis per year)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="radio" name="year-analysis-type" value="across">
            <span>Across Years (pooled temporal analysis)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="radio" name="year-analysis-type" value="both">
            <span>Both (compare within and across)</span>
        </label>
    </div>
    <div class="weight-info">Within: analyze each year separately. Across: pool all years together.</div>
</div>
```

### Task 4: Add Lorenz Curve Limitation Note

**Find the Lorenz curve plot div (search for "lorenz" in comparative analysis section)**

**Add After Lorenz Plot Div:**
```html
<div style="padding: 0.75rem 1rem; background: #fef3c7; border-left: 4px solid #f59e0b; margin-top: 1rem; border-radius: 4px;">
    <strong>⚠ Display Limitation:</strong> For visual clarity, the Lorenz curve is limited to displaying 3 countries at a time. 
    If more than 3 countries are selected, only the first 3 will be shown in the curve. 
    All selected countries will still be included in other analyses and metrics.
</div>
```

### Task 5: Add JavaScript Functions

**Add Before Closing `</script>` Tag (search for the end of JavaScript section):**

```javascript
// ============================================
// IMPROVED COUNTRY AND YEAR SELECTION
// ============================================

// Country selection functions
function selectAllCountries() {
    document.querySelectorAll('#country-checkboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
    updateCountriesSelectedCount();
}

function deselectAllCountries() {
    document.querySelectorAll('#country-checkboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    updateCountriesSelectedCount();
}

function updateCountriesSelectedCount() {
    const checked = document.querySelectorAll('#country-checkboxes input[type="checkbox"]:checked').length;
    const total = document.querySelectorAll('#country-checkboxes input[type="checkbox"]').length;
    document.getElementById('countries-selected-count').textContent = 
        `${checked} of ${total} countries selected`;
}

// Get selected countries
function getSelectedCountries() {
    return Array.from(document.querySelectorAll('#country-checkboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value);
}

// Year selection functions
function selectAllYears() {
    document.querySelectorAll('#year-checkboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
    updateYearsSelectedCount();
}

function deselectAllYears() {
    document.querySelectorAll('#year-checkboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    updateYearsSelectedCount();
}

function updateYearsSelectedCount() {
    const checked = document.querySelectorAll('#year-checkboxes input[type="checkbox"]:checked').length;
    const total = document.querySelectorAll('#year-checkboxes input[type="checkbox"]').length;
    document.getElementById('years-selected-count').textContent = 
        `${checked} of ${total} years selected`;
}

// Get selected years
function getSelectedYears() {
    return Array.from(document.querySelectorAll('#year-checkboxes input[type="checkbox"]:checked'))
        .map(cb => parseInt(cb.value));
}

// Get year analysis type
function getYearAnalysisType() {
    const selected = document.querySelector('input[name="year-analysis-type"]:checked');
    return selected ? selected.value : 'within';
}

// ============================================
// UPDATE POPULATE FUNCTIONS
// ============================================

// Replace the existing populateCountriesFromData function
function populateCountriesFromData(data) {
    const countries = [...new Set(data.map(d => d.country))].sort();
    const container = document.getElementById('country-checkboxes');
    
    if (!container) {
        console.warn('Country checkboxes container not found');
        return;
    }
    
    container.innerHTML = countries.map(country => `
        <label style="display: block; padding: 0.3rem 0; cursor: pointer; user-select: none;">
            <input type="checkbox" value="${country}" onchange="updateCountriesSelectedCount()">
            <span style="margin-left: 0.5rem;">${country}</span>
        </label>
    `).join('');
    
    updateCountriesSelectedCount();
}

// Replace the existing populateYearsFromData function
function populateYearsFromData(data) {
    const years = [...new Set(data.map(d => d.year))].sort();
    const container = document.getElementById('year-checkboxes');
    
    if (!container) {
        console.warn('Year checkboxes container not found');
        return;
    }
    
    container.innerHTML = years.map(year => `
        <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none;">
            <input type="checkbox" value="${year}" onchange="updateYearsSelectedCount()">
            <span>${year}</span>
        </label>
    `).join('');
    
    updateYearsSelectedCount();
}

// ============================================
// DIAGNOSTICS PAGE FUNCTIONS
// ============================================

function runDiagnostics() {
    const selectedCountries = getSelectedCountries();
    const selectedYears = getSelectedYears();
    
    if (!loadedPISAData || loadedPISAData.length === 0) {
        alert('Please load data first');
        return;
    }
    
    if (selectedCountries.length === 0 || selectedYears.length === 0) {
        alert('Please select at least one country and one year');
        return;
    }
    
    // Filter data
    const data = loadedPISAData.filter(d => 
        selectedCountries.includes(d.country) && selectedYears.includes(d.year)
    );
    
    if (data.length === 0) {
        alert('No data available for selected countries and years');
        return;
    }
    
    const showWithin = document.getElementById('diag-within-country').checked;
    const showBetween = document.getElementById('diag-between-country').checked;
    const showPooled = document.getElementById('diag-pooled').checked;
    
    let resultsHTML = '<div style="background: var(--surface); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">';
    resultsHTML += '<h3 style="margin-top: 0;">Regression Diagnostics Results</h3>';
    resultsHTML += `<p style="color: var(--text-secondary);">Analyzed ${data.length.toLocaleString()} students from ${selectedCountries.length} countries and ${selectedYears.length} years</p>`;
    resultsHTML += '</div>';
    
    // Pooled analysis
    if (showPooled) {
        const pooledResults = runSimpleRegression(data);
        resultsHTML += formatDiagnosticsResults('Pooled Analysis (All Countries Combined)', pooledResults, data);
    }
    
    // Within-country analysis
    if (showWithin) {
        resultsHTML += '<h3 style="margin: 2rem 0 1rem 0;">Within-Country Regression Coefficients</h3>';
        resultsHTML += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">';
        
        selectedCountries.forEach(country => {
            const countryData = data.filter(d => d.country === country);
            if (countryData.length > 0) {
                const results = runSimpleRegression(countryData);
                resultsHTML += formatCountryResults(country, results, countryData);
            }
        });
        
        resultsHTML += '</div>';
    }
    
    // Between-country analysis
    if (showBetween && selectedCountries.length > 1) {
        resultsHTML += '<h3 style="margin: 2rem 0 1rem 0;">Between-Country Variation</h3>';
        const betweenResults = analyzeBetweenCountryVariation(data, selectedCountries);
        resultsHTML += formatBetweenResults(betweenResults);
    }
    
    document.getElementById('diagnostics-results').innerHTML = resultsHTML;
}

function runSimpleRegression(data) {
    // Simple OLS regression: achievement ~ ses
    const validData = data.filter(d => 
        d.achievement != null && d.ses != null && 
        !isNaN(d.achievement) && !isNaN(d.ses)
    );
    
    if (validData.length < 10) {
        return { error: 'Insufficient data for regression' };
    }
    
    const n = validData.length;
    const meanSES = ss.mean(validData.map(d => d.ses));
    const meanAch = ss.mean(validData.map(d => d.achievement));
    
    // Calculate slope and intercept
    let sumXY = 0, sumX2 = 0;
    validData.forEach(d => {
        sumXY += (d.ses - meanSES) * (d.achievement - meanAch);
        sumX2 += (d.ses - meanSES) ** 2;
    });
    
    const slope = sumXY / sumX2;
    const intercept = meanAch - slope * meanSES;
    
    // Calculate R-squared and residuals
    const predicted = validData.map(d => intercept + slope * d.ses);
    const residuals = validData.map((d, i) => d.achievement - predicted[i]);
    const sst = validData.reduce((sum, d) => sum + (d.achievement - meanAch) ** 2, 0);
    const sse = residuals.reduce((sum, r) => sum + r ** 2, 0);
    const r2 = 1 - (sse / sst);
    
    // Standard error
    const mse = sse / (n - 2);
    const seSLOPE = Math.sqrt(mse / sumX2);
    const tStat = slope / seSLOPE;
    
    return {
        n,
        slope,
        intercept,
        r2,
        se: seSLOPE,
        tStat,
        residuals,
        predicted,
        meanAch,
        meanSES
    };
}

function formatDiagnosticsResults(title, results, data) {
    if (results.error) {
        return `<div style="background: #fee; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
            <strong>${title}:</strong> ${results.error}
        </div>`;
    }
    
    return `
        <div style="background: var(--surface); padding: 1.5rem; border-radius: 8px; margin: 1rem 0; border: 1px solid var(--border);">
            <h4 style="margin-top: 0;">${title}</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0;">
                <div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">SES Slope (β₁)</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--primary-color);">${results.slope.toFixed(2)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">points per SD</div>
                </div>
                <div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">R²</div>
                    <div style="font-size: 1.5rem; font-weight: 600;">${(results.r2 * 100).toFixed(1)}%</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">variance explained</div>
                </div>
                <div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">t-statistic</div>
                    <div style="font-size: 1.5rem; font-weight: 600;">${results.tStat.toFixed(2)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">SE = ${results.se.toFixed(3)}</div>
                </div>
                <div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Sample Size</div>
                    <div style="font-size: 1.5rem; font-weight: 600;">${results.n.toLocaleString()}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">students</div>
                </div>
            </div>
            <div style="margin-top: 1rem; padding: 0.75rem; background: var(--code-bg); border-radius: 4px; font-family: monospace; font-size: 0.9rem;">
                Achievement = ${results.intercept.toFixed(2)} + ${results.slope.toFixed(2)} × SES
            </div>
        </div>
    `;
}

function formatCountryResults(country, results, data) {
    if (results.error) {
        return `<div style="background: #fee; padding: 1rem; border-radius: 4px;">
            <strong>${country}:</strong> ${results.error}
        </div>`;
    }
    
    return `
        <div style="background: var(--surface); padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
            <h4 style="margin: 0 0 0.5rem 0;">${country}</h4>
            <div style="font-size: 0.9rem;">
                <div>Slope: <strong>${results.slope.toFixed(2)}</strong> (t=${results.tStat.toFixed(2)})</div>
                <div>R²: <strong>${(results.r2 * 100).toFixed(1)}%</strong></div>
                <div>n: ${results.n.toLocaleString()}</div>
            </div>
        </div>
    `;
}

function analyzeBetweenCountryVariation(data, countries) {
    const countryResults = countries.map(country => {
        const countryData = data.filter(d => d.country === country);
        const results = runSimpleRegression(countryData);
        return {
            country,
            slope: results.slope || 0,
            r2: results.r2 || 0,
            meanAch: results.meanAch || 0,
            n: results.n || 0
        };
    }).filter(r => r.n > 0);
    
    const slopes = countryResults.map(r => r.slope);
    const meanSlope = ss.mean(slopes);
    const sdSlope = ss.standardDeviation(slopes);
    const minSlope = Math.min(...slopes);
    const maxSlope = Math.max(...slopes);
    
    return {
        countryResults,
        meanSlope,
        sdSlope,
        minSlope,
        maxSlope,
        range: maxSlope - minSlope
    };
}

function formatBetweenResults(results) {
    return `
        <div style="background: var(--surface); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border);">
            <h4 style="margin-top: 0;">Between-Country Variation in SES Slopes</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin: 1.5rem 0;">
                <div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Mean Slope</div>
                    <div style="font-size: 1.4rem; font-weight: 600;">${results.meanSlope.toFixed(2)}</div>
                </div>
                <div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">SD of Slopes</div>
                    <div style="font-size: 1.4rem; font-weight: 600;">${results.sdSlope.toFixed(2)}</div>
                </div>
                <div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Range</div>
                    <div style="font-size: 1.4rem; font-weight: 600;">${results.minSlope.toFixed(2)} to ${results.maxSlope.toFixed(2)}</div>
                </div>
            </div>
            <p style="color: var(--text-secondary); margin-top: 1rem;">
                The standard deviation of ${results.sdSlope.toFixed(2)} indicates ${results.sdSlope > 5 ? 'substantial' : 'moderate'} 
                variation in the strength of socioeconomic gradients across countries.
            </p>
        </div>
    `;
}
```

### Task 6: Update All Analysis Functions to Use New Selection Methods

**In each analysis function (runAnalysis, runRegression, etc.), replace:**

```javascript
// OLD:
const selectedCountries = Array.from(document.getElementById('countries').selectedOptions)
    .map(opt => opt.value);

// NEW:
const selectedCountries = getSelectedCountries();

// OLD:
const selectedYears = Array.from(document.querySelectorAll('.year-btn.active'))
    .map(btn => parseInt(btn.dataset.year));

// NEW:
const selectedYears = getSelectedYears();
const yearAnalysisType = getYearAnalysisType();
```

## Integration Checklist

- [ ] Task 1: Update country selection HTML to checkboxes
- [ ] Task 2: Update year selection HTML to checkboxes  
- [ ] Task 3: Add within/across years analysis control
- [ ] Task 4: Add Lorenz curve limitation note
- [ ] Task 5: Add all JavaScript functions
- [ ] Task 6: Update analysis functions to use getSelectedCountries() and getSelectedYears()
- [ ] Test all functionality with sample data
- [ ] Verify methods document downloads correctly
- [ ] Test diagnostics page with multiple countries
- [ ] Verify within/between country analysis works

## Files Ready to Use

1. ✅ `export_full_csv.R` - Export full dataset as CSV
2. ✅ `Methods_Document.html` - Comprehensive methods documentation
3. ✅ `educational_inequality_explorer_v2.html` - Partially updated HTML (needs Tasks 1-6)

## Testing Procedure

1. Load `pisa_data_medium.csv` in the application
2. Test country selection checkboxes (select all, deselect all, individual selection)
3. Test year selection checkboxes
4. Test diagnostics page with:
   - Single country, single year
   - Multiple countries, single year (within-country analysis)
   - Multiple countries, multiple years (between-country analysis)
5. Verify method document downloads
6. Check Lorenz curve displays warning when >3 countries selected
7. Test within/across years analysis options

## Notes

- The HTML file `educational_inequality_explorer_v2.html` has the tabs and methodology sections updated
- JavaScript functions are provided as complete, ready-to-paste code blocks
- All updates maintain the existing visual style and design
- Functions include error handling and user feedback
- Code is commented for maintainability

## Support

For questions about implementation:
1. Check this document for code snippets
2. Review `html_updates.md` for additional examples
3. Test incrementally after each change
4. Use browser console (F12) to debug JavaScript issues
