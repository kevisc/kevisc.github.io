Learning Outcomes (PISA/TIMSS/PIRLS) – API Manifests
====================================================
This folder contains JSON manifests and a CSV catalog listing World Bank EdStats indicator codes
for international large-scale assessment outcomes that your app can fetch at runtime.

Files
-----
- worldbank_learning_outcomes_pisa.json
- worldbank_learning_outcomes_timss.json
- worldbank_learning_outcomes_pirls.json
- learning_outcomes_indicator_catalog.csv

How to use in your app
----------------------
1) Use the "World Bank" source in your app and paste any indicator code from the catalog (e.g., LO.PISA.MAT).
2) (Optional) If you'd like a prebuilt URL, copy the `example_api_url` from the CSV. It already includes
   the app's default country list and the `per_page=20000` parameter.
3) The app should parse the response into a {"date": "...", "USA": value, ...}-style series like in the sample.

Notes
-----
- The indicator codes listed here are confirmed widely used in World Bank EdStats (Learning Outcomes).
- Sex-disaggregated codes end with `.FE` (female) or `.MA` (male).
- For PISA, proficiency tail indicators (e.g., LO.PISA.MAT.0) capture % below the lowest proficiency threshold.
- TIMSS codes distinguish grades: `MAT4`/`SCI4` for grade 4; `MAT8`/`SCI8` for grade 8.
- PIRLS covers grade 4 reading (`LO.PIRLS.REA` and sex splits).

License
-------
World Bank Open Data (CC BY 4.0) – see the World Bank Data license.