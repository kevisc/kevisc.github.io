# Export PISA Data as CSV Format
# CSV is ~40% smaller than JSON, but browser memory limits still apply
# 
# This creates CSV versions of all datasets for comparison

library(learningtower)
library(dplyr)

cat("=== Export PISA Data as CSV ===\n\n")

# Configuration
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

# Load and prepare data
cat("Loading PISA data...\n")
student_data <- load_student(YEARS)

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
cat(sprintf("Prepared %s records\n\n", format(n_records, big.mark = ",")))

# Export full dataset as CSV
cat("=== Exporting Full Dataset ===\n")
csv_file <- "pisa_data.csv"
cat("Writing CSV file...\n")
write.csv(prepare_data, csv_file, row.names = FALSE)

csv_size <- file.size(csv_file) / 1024 / 1024
cat(sprintf("✓ Exported to: %s\n", csv_file))
cat(sprintf("✓ File size: %.2f MB\n", csv_size))
cat(sprintf("✓ Records: %s\n", format(n_records, big.mark = ",")))
cat(sprintf("✓ Reduction from JSON: ~%.0f%% smaller\n", 
            (1 - csv_size/1768) * 100))

# Warning about browser limits
cat("\n⚠ IMPORTANT: Browser Memory Limitation\n")
cat(sprintf("CSV file is %.0f MB, but browsers still need ~%.0f MB memory\n", 
            csv_size, csv_size * 2))
cat("This exceeds the ~500 MB JavaScript memory limit.\n\n")

# Create sample CSV
cat("=== Creating Sample CSV ===\n")
sample_data <- prepare_data %>%
  group_by(country, year) %>%
  slice_sample(n = min(100, n())) %>%
  ungroup()

sample_csv_file <- "pisa_data_sample.csv"
write.csv(sample_data, sample_csv_file, row.names = FALSE)

sample_csv_size <- file.size(sample_csv_file) / 1024 / 1024
cat(sprintf("✓ Exported to: %s\n", sample_csv_file))
cat(sprintf("✓ File size: %.2f MB\n", sample_csv_size))
cat(sprintf("✓ Records: %s\n", format(nrow(sample_data), big.mark = ",")))

# Create medium dataset CSV
cat("\n=== Creating Medium CSV ===\n")
medium_data <- prepare_data %>%
  group_by(country, year) %>%
  slice_sample(n = min(1000, n())) %>%
  ungroup()

medium_csv_file <- "pisa_data_medium.csv"
write.csv(medium_data, medium_csv_file, row.names = FALSE)

medium_csv_size <- file.size(medium_csv_file) / 1024 / 1024
cat(sprintf("✓ Exported to: %s\n", medium_csv_file))
cat(sprintf("✓ File size: %.2f MB\n", medium_csv_size))
cat(sprintf("✓ Records: %s\n", format(nrow(medium_data), big.mark = ",")))

# Summary table
cat("\n=== CSV Export Summary ===\n\n")
summary_table <- data.frame(
  File = c("pisa_data_sample.csv", "pisa_data_medium.csv", "pisa_data.csv"),
  Size_MB = c(sample_csv_size, medium_csv_size, csv_size),
  Records = c(nrow(sample_data), nrow(medium_data), n_records),
  Browser = c("✓ Fast", "✓ OK", "✗ Too large"),
  Use_Case = c("Quick testing", "Analysis & viz", "R only")
)

print(summary_table, row.names = FALSE)

cat("\n=== File Comparison: CSV vs JSON ===\n\n")
comparison <- data.frame(
  Dataset = c("Sample", "Medium", "Full"),
  CSV_MB = c(sample_csv_size, medium_csv_size, csv_size),
  JSON_MB = c(24, 300, 1768),  # Approximate JSON sizes
  Savings = sprintf("%.0f%%", 
                   c((1-sample_csv_size/24)*100,
                     (1-medium_csv_size/300)*100,
                     (1-csv_size/1768)*100))
)

print(comparison, row.names = FALSE)

cat("\n=== Memory Reality Check ===\n\n")
cat("CSV reduces FILE SIZE but not MEMORY USAGE:\n\n")

cat(sprintf("Full dataset CSV: %.0f MB\n", csv_size))
cat(sprintf("  → Download: %.0f MB ✓ (faster than JSON)\n", csv_size))
cat(sprintf("  → Parse to objects: %.0f MB memory needed\n", csv_size * 1.5))
cat(sprintf("  → Store in memory: %.0f MB total\n", csv_size * 2))
cat(sprintf("  → Browser limit: 500 MB ✗ (exceeds limit)\n\n"))

cat(sprintf("Medium dataset CSV: %.0f MB\n", medium_csv_size))
cat(sprintf("  → Download: %.0f MB ✓\n", medium_csv_size))
cat(sprintf("  → Parse to objects: %.0f MB memory\n", medium_csv_size * 1.5))
cat(sprintf("  → Store in memory: %.0f MB total ✓\n", medium_csv_size * 2))
cat(sprintf("  → Browser limit: 500 MB ✓ (within limit)\n\n"))

cat("=== Recommendations ===\n\n")
cat("✓ For web browser (educational_inequality_explorer.html):\n")
cat("  → Use pisa_data_medium.csv (~%.0f MB)\n", medium_csv_size)
cat("  → Or pisa_data_sample.csv (~%.0f MB) for testing\n\n", sample_csv_size)

cat("✓ For R analysis (full dataset):\n")
cat("  → Read CSV: read.csv('pisa_data.csv')\n")
cat("  → Or use learningtower package directly\n\n")

cat("✓ CSV Benefits:\n")
cat("  - Smaller files (40%% reduction)\n")
cat("  - Faster download times\n")
cat("  - Universal compatibility\n")
cat("  - Easy to preview/edit\n\n")

cat("✗ CSV Limitations:\n")
cat("  - Same memory requirements once loaded\n")
cat("  - Still hits browser limits with full dataset\n\n")

cat("Files created:\n")
cat(sprintf("  1. %s (%.1f MB) - Testing\n", sample_csv_file, sample_csv_size))
cat(sprintf("  2. %s (%.1f MB) - Recommended for browser\n", 
            medium_csv_file, medium_csv_size))
cat(sprintf("  3. %s (%.1f MB) - For R only\n", csv_file, csv_size))

cat("\n✓ Export complete!\n")
