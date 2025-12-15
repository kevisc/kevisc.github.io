# 2_make_timss.R
library(EdSurvey); library(dplyr)
source("harmonize_lsas.R")

# TIMSS 2019 (Grade 8)
timss19 <- readTIMSS(path = "path/to/TIMSS_2019")

timss_raw <- getData(timss19,
  varnames = c("CNTRYID","YEAR","IDSTUD","IDSCHOOL","ITSEX",
               "TOTWGT", paste0("JK", sprintf("%02d", 1:75)), paste0("RW", 1:150),
               paste0("ASMMAT", sprintf("%02d", 1:10)), paste0("ASSSCI", sprintf("%02d", 1:10)),
               "HISEI","ASBGHISCED","ASBGBOOK"),
  addAttributes = TRUE, omittedLevels = FALSE, dropOmittedLevels = FALSE
)

timss_df <- make_uniform(timss_raw, assessment = "TIMSS", cycle_label = 2019, pv_subject = "MATH", pv_method = "mean")

timss_df <- timss_df |> filter(country %in% c("CHE","ITA","DEU"))
write_outputs(timss_df, file_stem = "timss_2019_g8_math_sample", sample_per_cy = 12000L)

# --- Alternative using intsvy (commented) ---
# library(intsvy); library(dplyr); source("harmonize_lsas.R")
# timss_raw2 <- timss.select.merge(folder = "path/to/TIMSS_2019",
#   student = c("CNTRYID","YEAR","IDSTUD","IDSCHOOL","ITSEX","HISEI","ASBGHISCED","ASBGBOOK",
#               paste0("ASMMAT", sprintf("%02d", 1:10))),
#   countries = c("CHE","ITA","DEU")
# )
# timss_df2 <- make_uniform(timss_raw2, assessment = "TIMSS", cycle_label = 2019, pv_subject = "MATH")
# write_outputs(timss_df2, "timss_2019_intsvy_math_sample", 12000L)
