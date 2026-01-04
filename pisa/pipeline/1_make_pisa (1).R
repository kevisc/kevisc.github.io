# 1_make_pisa.R
library(EdSurvey); library(dplyr)
source("harmonize_lsas.R")

# Adjust to your local PISA 2022 release directory
# Example: "C:/data/PISA_2022" or "/Users/you/data/PISA_2022"
pisa22 <- readPISA(path = "path/to/PISA_2022")

pisa_raw <- getData(pisa22,
  varnames = c("CNT","YEAR","STIDSTD","SCHOOLID","ESCS","HISCED","IMMIG","ST004D01T",
               "W_FSTUWT","W_FSENWT", paste0("W_FSTR", 1:80),
               paste0("PV", 1:10, "READ"), paste0("PV", 1:10, "MATH"), paste0("PV", 1:10, "SCIE")),
  addAttributes = TRUE, omittedLevels = FALSE, dropOmittedLevels = FALSE
)

pisa_df <- make_uniform(pisa_raw, assessment = "PISA", cycle_label = 2022, pv_subject = "READ", pv_method = "mean")

# Optional: limit countries for smaller files
pisa_df <- pisa_df |> filter(country %in% c("CHE","ITA","DEU","USA"))

write_outputs(pisa_df, file_stem = "pisa_2022_read_sample", sample_per_cy = 15000L)
