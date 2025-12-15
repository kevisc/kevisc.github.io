# Create Medium-Sized PISA Dataset for Web Browser
# This creates a dataset under 500 MB that browsers can handle
# 
# Strategy: Sample strategically to maintain representativeness while reducing size

library(learningtower)
library(dplyr)
library(jsonlite)

cat("=== Creating Medium-Sized PISA Dataset ===\n\n")

# CONFIGURATION: Adjust these to control file size
# ------------------------------------------------
STUDENTS_PER_COUNTRY_YEAR <- 1000  # Default: 1000 students per country-year
SELECTED_YEARS <- c(2012, 2015, 2018, 2022)  # All available years
# To reduce size further, use fewer years: c(2018, 2022)

# Optional: Select specific countries (NULL = all countries)
# Examples:
# - OECD countries: c("AUS", "AUT", "BEL", "CAN", "CHL", "COL", "CZE", "DNK", "EST", 
#                     "FIN", "FRA", "DEU", "GRC", "HUN", "ISL", "IRL", "ISR", "ITA", 
#                     "JPN", "KOR", "LVA", "LTU", "LUX", "MEX", "NLD", "NZL", "NOR", 
#                     "POL", "PRT", "SVK", "SVN", "ESP", "SWE", "CHE", "TUR", "GBR", "USA")
# - Major economies: c("USA", "CHN", "JPN", "DEU", "GBR", "FRA", "IND", "BRA", "ITA", "CAN")
SELECTED_COUNTRIES <- NULL  # NULL = all countries

cat("Configuration:\n")
cat(sprintf("  Students per country-year: %d\n", STUDENTS_PER_COUNTRY_YEAR))
cat(sprintf("  Years: %s\n", paste(SELECTED_YEARS, collapse = ", ")))
if (!is.null(SELECTED_COUNTRIES)) {
  cat(sprintf("  Countries: %s\n", paste(SELECTED_COUNTRIES, collapse = ", ")))
} else {
  cat("  Countries: All available\n")
}

# Load data
cat("\nLoading PISA data...\n")
student_data <- load_student(SELECTED_YEARS)

if (!is.null(SELECTED_COUNTRIES)) {
  student_data <- student_data %>%
    filter(country %in% SELECTED_COUNTRIES)
}

cat(sprintf("Loaded %s total records\n", format(nrow(student_data), big.mark = ",")))

# Convert parent education
convert_parent_edu <- function(educ_var) {
  case_when(
    is.na(educ_var) ~ 3L,
    educ_var == "less than ISCED1" ~ 0L,
    educ_var == "ISCED 1" ~ 1L,
    educ_var == "ISCED 2" ~ 2L,
    educ_var == "ISCED 3B, C" ~ 3L,
    educ_var == "ISCED 3A" ~ 4L,
    educ_var %in% c("ISCED 5B", "ISCED 5A, 6") ~ 5L,
    TRUE ~ 3L
  )
}

# Prepare and sample data
cat("\nPreparing and sampling data...\n")
prepare_data <- student_data %>%
  filter(
    !is.na(math),
    !is.na(read),
    !is.na(science),
    !is.na(escs)
  ) %>%
  mutate(
    studentId = paste(country, year, student_id, sep = "_"),
    schoolId = paste(country, year, school_id, sep = "_"),
    achievement = math,
    ses = escs,
    gender = ifelse(gender == "female", 0, 1),
    mother_edu_num = convert_parent_edu(mother_educ),
    father_edu_num = convert_parent_edu(father_educ),
    parentEdu = pmax(mother_edu_num, father_edu_num, na.rm = TRUE),
    computerNum = ifelse(computer == "yes", 1, 0),
    internetNum = ifelse(internet == "yes", 1, 0),
    bookNum = case_when(
      book == "0-10" ~ 5,
      book == "11-25" ~ 18,
      book == "26-100" ~ 63,
      book == "101-200" ~ 150,
      book == "201-500" ~ 350,
      book == "more than 500" ~ 500,
      TRUE ~ 63
    ),
    wealth = coalesce(wealth, 0),
    immigrant = NA_integer_,
    schoolType = NA_integer_,
    schoolSize = NA_integer_,
    urbanRural = NA_integer_,
    teacherRatio = NA_real_,
    ictResources = NA_real_,
    classSize = NA_integer_,
    homeworkHours = NA_real_,
    studentWeight = stu_wgt,
    senateWeight = stu_wgt
  ) %>%
  rowwise() %>%
  mutate(replicateWeights = list(rep(stu_wgt, 80))) %>%
  ungroup() %>%
  # STRATIFIED SAMPLING: Maintain representativeness
  group_by(country, year) %>%
  slice_sample(n = min(STUDENTS_PER_COUNTRY_YEAR, n())) %>%
  ungroup() %>%
  select(
    country, year, studentId, schoolId, achievement, ses,
    gender, immigrant, parentEdu, 
    computerNum, internetNum, bookNum, wealth,
    schoolType, schoolSize, urbanRural, teacherRatio, 
    ictResources, classSize, homeworkHours,
    studentWeight, senateWeight, replicateWeights
  )

cat(sprintf("Sampled to %s records\n", format(nrow(prepare_data), big.mark = ",")))

# Show distribution
cat("\n=== Data Distribution ===\n")
distribution <- prepare_data %>%
  group_by(country, year) %>%
  summarise(n = n(), .groups = 'drop') %>%
  arrange(country, year)

cat(sprintf("Countries: %d\n", n_distinct(prepare_data$country)))
cat(sprintf("Country-year combinations: %d\n", nrow(distribution)))
cat("\nRecords per country-year (first 15):\n")
print(head(distribution, 15))

# Summary statistics
cat("\n=== Data Summary ===\n")
cat("Achievement score range:", round(min(prepare_data$achievement)), "-", 
    round(max(prepare_data$achievement)), "\n")
cat("SES range:", round(min(prepare_data$ses), 2), "-", 
    round(max(prepare_data$ses), 2), "\n")
cat("Mean achievement:", round(mean(prepare_data$achievement), 1), "\n")
cat("Mean SES:", round(mean(prepare_data$ses), 3), "\n")

# Export to JSON
output_file <- "pisa_data_medium.json"
cat("\n=== Exporting to JSON ===\n")
cat("This may take a minute or two...\n")

json_data <- toJSON(prepare_data, pretty = FALSE, auto_unbox = FALSE)
write(json_data, output_file)

file_size_mb <- file.size(output_file) / 1024 / 1024
cat(sprintf("\n✓ Data exported successfully to %s\n", output_file))
cat(sprintf("✓ File size: %.2f MB\n", file_size_mb))
cat(sprintf("✓ Records: %s\n", format(nrow(prepare_data), big.mark = ",")))

# Check if it's within browser limits
if (file_size_mb <= 500) {
  cat("\n✓ File size is within browser memory limits (≤500 MB)\n")
  cat("✓ This file should load successfully in the web application\n")
} else {
  cat(sprintf("\n⚠ Warning: File is %.0f MB (exceeds 500 MB browser limit)\n", file_size_mb))
  cat("\nTo reduce file size:\n")
  cat("  1. Reduce STUDENTS_PER_COUNTRY_YEAR (currently %d)\n", STUDENTS_PER_COUNTRY_YEAR)
  cat("  2. Use fewer years (currently: %s)\n", paste(SELECTED_YEARS, collapse = ", "))
  cat("  3. Select specific countries using SELECTED_COUNTRIES\n")
}

# Estimate different sizes
cat("\n=== File Size Estimates for Different Settings ===\n")
base_size_per_student <- file_size_mb / nrow(prepare_data)
cat(sprintf("Approximate size per student: %.3f KB\n", base_size_per_student * 1024))

estimates <- data.frame(
  students_per_cy = c(100, 250, 500, 1000, 2000),
  estimated_mb = c(100, 250, 500, 1000, 2000) * 
    n_distinct(prepare_data$country, prepare_data$year) * 
    base_size_per_student
)

cat("\nEstimated file sizes:\n")
estimates$suitable <- ifelse(estimates$estimated_mb <= 500, "✓ Suitable", "✗ Too large")
print(estimates)

# Mean achievement by country
cat("\n=== Mean Achievement by Country (Top 15) ===\n")
summary_stats <- prepare_data %>% 
  group_by(country) %>% 
  summarise(
    mean_achievement = mean(achievement, na.rm = TRUE),
    mean_ses = mean(ses, na.rm = TRUE),
    n = n(),
    .groups = 'drop'
  ) %>%
  arrange(desc(mean_achievement)) %>%
  head(15)

print(summary_stats, n = 15)

cat("\n=== Export Complete ===\n")
cat("\nFiles available:\n")
cat("  1. pisa_data_sample.json (~25 MB) - Quick testing\n")
cat(sprintf("  2. pisa_data_medium.json (%.0f MB) - Current file, balanced size\n", file_size_mb))
cat("  3. pisa_data.json (~1768 MB) - Full dataset (too large for browser)\n")

cat("\n✓ Recommended: Use pisa_data_medium.json with the web application\n")
cat("\nNext steps:\n")
cat("  1. Open educational_inequality_explorer_fixed.html in your browser\n")
cat("  2. Click 'Load PISA Data File'\n")
cat("  3. Select pisa_data_medium.json\n")
