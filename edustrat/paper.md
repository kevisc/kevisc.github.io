---
title: 'EduStrat: A Browser-Based Tool for Teaching Quantitative Analysis of Educational Inequality with PISA Microdata'
tags:
  - JavaScript
  - R
  - education
  - educational inequality
  - PISA
  - socioeconomic status
  - survey weighting
  - intergenerational transmission
  - teaching tool
authors:
  - name: Kevin Schoenholzer
    orcid: 0000-0001-9892-5869
    affiliation: 1
affiliations:
  - name: Institute of Communication and Public Policy, Università della Svizzera italiana (USI), Lugano, Switzerland
    index: 1
date: 25 March 2026
bibliography: paper.bib
---

# Summary

EduStrat (Educational Stratification in PISA) is a browser-based, open-source tool that enables students, instructors, and researchers to explore how parental socioeconomic characteristics predict student academic achievement using microdata from the OECD Programme for International Student Assessment [PISA; @oecd2024pisa]. The tool covers eight PISA cycles (2000--2022), more than 100 countries, and approximately 3.5 million student observations. Users select countries and years through an interactive interface; the application loads pre-generated data subsets on demand and performs all statistical computations client-side---requiring no software installation, no server, and no programming. EduStrat computes survey-weighted descriptive statistics, inequality indices (Gini coefficient, Lorenz curves, percentile ratios), regression models (pooled OLS, fixed effects, random effects) with diagnostic tests, achievement gap decomposition, and variance decomposition. Where the data carry PISA's replicate weights, design-correct standard errors are computed by balanced repeated replication (BRR, Fay's method) rather than the simple-random-sampling formulae. Every estimator is verified numerically against independent R reference implementations (see *Verification and reproducibility*). All outputs can be exported as CSV tables, publication-quality figures (PNG/SVG), or self-contained HTML reports with embedded analytic metadata. In accordance with the OECD Terms of Use for PISA Public Use Files, the application does not redistribute micro-level student data; all exports provide computed estimates and aggregated statistics only.

# Statement of Need

Courses in comparative education, educational policy, and quantitative social science frequently engage with PISA data to illustrate concepts such as educational inequality, intergenerational transmission, and cross-national variation in achievement. However, working with PISA microdata presents substantial pedagogical barriers. The data arise from complex stratified sampling designs requiring proper survey weighting; achievement is released as plausible values; and results are sensitive to choices about weights, country selections, and regression specifications [@oecd2009; @wu2005; @mislevy1992]. Teaching these concepts typically requires students to write code in R, Stata, or Python before producing even basic descriptive summaries---diverting class time from substantive learning to software troubleshooting.

Existing tools partially address this gap. The `learningtower` R package [@wang2024] provides cleaned PISA extracts, but requires R proficiency. The OECD's PISA Data Explorer offers a web interface but is limited to pre-tabulated summaries without regression modelling or diagnostic testing. The `intsvy` [@caro2017] and `EdSurvey` [@bailey2024] R packages provide comprehensive analytical capabilities but assume substantial programming experience.

EduStrat fills the space between these tools: it provides the analytical depth of R-based packages (regression, decomposition, diagnostics) in an accessible browser interface that requires no installation or coding. This allows instructors to focus class time on interpreting results, comparing specifications, and understanding methodological choices---rather than debugging software environments. Students can immediately engage with questions like: *How does the ESCS gradient differ between Finland and the United States? How does the Hausman test inform the choice between fixed and random effects? What happens to inequality metrics when we change the country selection?*

# Functionality and Teaching Use

EduStrat implements the core quantitative methods taught in graduate courses on educational inequality and comparative education, organised across interactive analysis tabs.

**Survey-weighted descriptive statistics.** Students learn why sampling weights matter by toggling between weighted and unweighted results and observing how estimates change. The tool computes weighted means, standard deviations, and quantiles following OECD guidelines [@oecd2009].

**Inequality metrics.** The Gini coefficient, coefficient of variation, percentile ratios (P90/P10), and Lorenz curves allow students to compare distributional properties of achievement across countries and understand what each metric captures.

**ESCS gradients and quartile gaps.** The central measure of intergenerational transmission---the regression slope of achievement on the ESCS index [@wuyts2024]---is computed with interactive visualisations showing scatter plots and fitted lines. Quartile-based gaps (Q4--Q1) with Cohen's *d* provide intuitive effect size interpretation.

**Regression model comparison.** Students estimate pooled OLS, country fixed-effects, and random-effects models side by side, with coefficient tables, diagnostic plots (residual vs. fitted, Q-Q plots), and the Hausman specification test. This teaches specification sensitivity: how conclusions about the SES--achievement relationship change depending on modelling choices. Standard errors default to BRR replicate-weight estimates when the data provide them, and the interface labels which method is active---making visible how much PISA's complex sampling design inflates uncertainty relative to the naive formulae.

**Variance decomposition.** Within- and between-country decomposition with intraclass correlation illustrates multilevel structure in educational data.

**Export system.** Results are exportable as CSV, PNG/SVG, or self-contained HTML reports with embedded analytic metadata (countries, years, variables, weight choice, model specification). This supports reproducibility and teaches students to document their analytic decisions. Per OECD Terms of Use, exports provide aggregated statistics and computed estimates only---not individual student records.

The tool has been used in graduate-level instruction at the Università della Svizzera italiana to teach survey weighting, regression specification sensitivity, and cross-country inequality comparisons. Its browser-based design has proven effective in workshop settings where participants have heterogeneous software environments. Instructors can adopt EduStrat by directing students to the hosted application or by serving it locally with any HTTP server. The modular codebase (20 ES6 JavaScript modules, ~11,200 lines) and comprehensive documentation (methodology, data sources, variable codebook) support both direct use and adaptation.

# Project Story

EduStrat originated from the practical challenge of teaching quantitative methods in comparative education. Preparing PISA microdata for classroom demonstrations required writing substantial data-wrangling and analysis code before each session, and students without R or Stata experience could not independently replicate or extend the analyses shown in class. The tool was developed to package these recurring analytical operations---weighted descriptives, gradient estimation, specification comparison, variance decomposition---into a self-contained web application that students could use immediately.

The intellectual work behind EduStrat is not the production of JavaScript, HTML and CSS; it is the set of decisions about *which* methods belong in an instrument for teaching educational stratification, *how* each should be estimated so that a browser reproduces what `R` or `Stata` would produce, and *how* to make the methodological choices that PISA forces on every analyst visible to students rather than hidden inside a library. Those choices---the ESCS gradient as the operational measure of intergenerational transmission [@wuyts2024]; the fixed- versus random-effects contrast as a lesson in specification sensitivity; survey weighting and replicate-weight variance estimation as the difference between description and inference---are the scholarship; the code is their implementation.

The data architecture reflects a key constraint: serving approximately 3.5 million student records to a browser. Rather than loading the full ~1.25 GB dataset, EduStrat pre-generates 513 country--year JSON files and loads only the requested subsets (typically 30--40 MB). The data pipeline consists of R scripts that extract, chunk, and validate PISA microdata from the `learningtower` package [@wang2024].

Two methodological points received particular attention because they bear directly on whether the tool teaches *inference* or only *description*. First, EduStrat uses a single plausible value per domain---a constraint inherited from `learningtower`, which distributes only PV1---so the measurement (imputation) component of variance is not estimated; this is stated in the interface and is itself used as a teaching point about plausible values. Second, and in response to the recommendation that PISA estimates use the OECD's replicate weights, the project moved beyond `learningtower` (which ships only the final weight `W_FSTUWT`): a dedicated pipeline script re-sources the raw OECD Public Use Files and regenerates chunks that carry the 80 Fay replicate weights, so that standard errors can be computed by balanced repeated replication exactly as the OECD prescribes. This was implemented and verified across three cycles (2015, 2018, 2022) for a set of countries as a documented, reproducible template rather than a full re-release. The design-correct standard errors are noticeably larger than the naive ones, by a factor that is stable across cycles (for the Finnish mathematics mean, the BRR error is 1.7--2.0 times the simple-random-sampling error in 2015, 2018 and 2022 alike)---making the cost of ignoring the sampling design something students can see, not merely be told.

# Verification and reproducibility

Because EduStrat performs all computation client-side in JavaScript, the central scholarly question is whether those in-browser estimates can be trusted. The project answers this with a verification harness that treats the JavaScript artifact as untrusted and holds it to established statistical software. The harness runs the application's *own* analysis modules in Node---providing only the same two numeric libraries the browser loads---against real PISA chunks, and compares every reported quantity against an independent reference computed in R from peer-reviewed packages: `stats::lm` for weighted OLS and least-squares dummy-variable fixed effects, `plm` for the Swamy--Arora random-effects estimator and the Hausman test, `lmtest` for the Breusch--Pagan test, `car` for variance inflation factors, `stats::cooks.distance` for influence, and `intsvy` for BRR replicate-weight standard errors.

Across 83 computational checks (point estimates, standard errors, test statistics, R², degrees of freedom) and 21 replicate-weight checks spanning three cycles, all agree with the R references; the large majority match to between ten and fourteen significant figures. A headless-browser smoke-test additionally confirms that the application runs in a real browser engine with no errors and that the rendered output reports the BRR standard errors. The few quantities that do not match to machine precision are documented honestly rather than tuned away: the random-effects slope matches `plm` to seven significant figures, and the Hausman statistic---which divides the squared fixed-/random-effects contrast by a near-zero variance difference---is reproduced to about two parts in a thousand, a sensitivity inherent to the statistic rather than an error in its implementation. Several estimators were corrected during this process (the weighted Gini coefficient, the Breusch--Pagan test, the variance inflation factors, the Cook's distance leverages, and the Hausman variance term), with the harness serving as the regression test. The full procedure, tolerances, and per-method results are recorded in the repository (`VERIFICATION.md`, `pipeline/scripts/04-verify-computations.R`, `pipeline/scripts/06-verify-brr.R`) and can be re-run by any reviewer.

# Use of generative AI

Generative AI tools (Claude, Anthropic) were used substantially during development to generate and refactor the application code (JavaScript, HTML, CSS) and to draft documentation. The author directed the design and methodological choices, specified the estimators and their intended behaviour, and---critically---supervised all AI-generated computation through the R-based verification described above: no statistical method is reported as correct on the strength of its having been generated, only on the strength of its agreement with an independent R reference that the author wrote and can re-run. The verification scripts, not the generated code, are the warrant for the results. Remaining limitations (single plausible value; limited-scope replicate-weight coverage) are documented in the interface and in this paper.

# Acknowledgements

This work uses data from the OECD Programme for International Student Assessment [@oecd2024pisa], accessed via the `learningtower` R package [@wang2024] and, for replicate weights, the OECD PISA Public Use Files (2015, 2018, 2022). The author thanks the OECD for making PISA data publicly available and the `learningtower` development team for their data harmonisation work, and acknowledges support from the Università della Svizzera italiana.

# References
