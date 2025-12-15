# Export Full PISA Dataset as CSV
# Warning: Creates a large file (~1GB) suitable for R analysis, not browser use

library(learningtower)
library(dplyr)

cat("=== Export Full PISA Dataset as CSV ===\n\n")
cat("⚠ WARNING: This creates a ~1GB CSV file\n")
cat("This file is for R/Python analysis only, NOT for browser use\n\n")

YEARS <- c(2012, 2015, 2018, 2022)

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

cat("Loading PISA data...\n")
student_data <- load_student(YEARS)

cat(sprintf("Loaded %s records\n", format(nrow(student_data), big.mark = ",")))

cat("\nPreparing data...\n")
prepare_data <- student_data %>%
  filter(!is.na(math), !is.na(read), !is.na(science), !is.na(escs)) %>%
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
      book == "0-10" ~ 5, book == "11-25" ~ 18, book == "26-100" ~ 63,
      book == "101-200" ~ 150, book == "201-500" ~ 350,
      book == "more than 500" ~ 500, TRUE ~ 63
    ),
    wealth = coalesce(wealth, 0),
    immigrant = NA_integer_, schoolType = NA_integer_,
    schoolSize = NA_integer_, urbanRural = NA_integer_,
    teacherRatio = NA_real_, ictResources = NA_real_,
    classSize = NA_integer_, homeworkHours = NA_real_,
    studentWeight = stu_wgt, senateWeight = stu_wgt
  ) %>%
  select(
    country, year, studentId, schoolId, achievement, ses,
    gender, immigrant, parentEdu, computerNum, internetNum,
    bookNum, wealth, schoolType, schoolSize, urbanRural,
    teacherRatio, ictResources, classSize, homeworkHours,
    studentWeight, senateWeight
  )

n_records <- nrow(prepare_data)
cat(sprintf("Prepared %s records for export\n\n", format(n_records, big.mark = ",")))

# Export
csv_file <- "pisa_data_full.csv"
cat("Writing CSV file (this may take a few minutes)...\n")
write.csv(prepare_data, csv_file, row.names = FALSE)

file_size_mb <- file.size(csv_file) / 1024 / 1024
cat(sprintf("\n✓ Exported to: %s\n", csv_file))
cat(sprintf("✓ File size: %.2f MB\n", file_size_mb))
cat(sprintf("✓ Records: %s\n", format(n_records, big.mark = ",")))

cat("\n=== Usage ===\n")
cat("In R:\n")
cat(sprintf("  pisa <- read.csv('%s')\n", csv_file))
cat("\nIn Python:\n")
cat(sprintf("  import pandas as pd\n"))
cat(sprintf("  pisa = pd.read_csv('%s')\n", csv_file))

cat("\n⚠ Do NOT load this file in the web browser\n")
cat("Use pisa_data_medium.csv for browser analysis\n\n")

cat("✓ Export complete!\n")
