# Compare File Formats for PISA Data
# Test different formats to find the most efficient for browser loading

library(learningtower)
library(dplyr)
library(jsonlite)
library(arrow)  # For parquet format

cat("=== File Format Comparison for PISA Data ===\n\n")

# Load a sample to test different formats
cat("Loading sample data for testing...\n")
years_to_test <- c(2018, 2022)
student_data <- load_student(years_to_test)

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

# Prepare data
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
cat(sprintf("Sample size: %s records\n\n", format(n_records, big.mark = ",")))

# Test different formats
cat("=== Exporting to Different Formats ===\n\n")
results <- data.frame(
  format = character(),
  file_size_mb = numeric(),
  compression_ratio = numeric(),
  load_time_est = character(),
  browser_compatible = character(),
  notes = character(),
  stringsAsFactors = FALSE
)

# 1. JSON (current format)
cat("1. Testing JSON format...\n")
json_file <- "test_format_data.json"
json_data <- toJSON(prepare_data, pretty = FALSE, auto_unbox = FALSE)
write(json_data, json_file)
json_size <- file.size(json_file) / 1024 / 1024
cat(sprintf("   File size: %.2f MB\n", json_size))

results <- rbind(results, data.frame(
  format = "JSON",
  file_size_mb = json_size,
  compression_ratio = 1.0,
  load_time_est = "Baseline",
  browser_compatible = "Yes",
  notes = "Current format, verbose"
))

# 2. CSV format
cat("2. Testing CSV format...\n")
csv_file <- "test_format_data.csv"
write.csv(prepare_data, csv_file, row.names = FALSE)
csv_size <- file.size(csv_file) / 1024 / 1024
cat(sprintf("   File size: %.2f MB (%.1f%% of JSON)\n", 
            csv_size, (csv_size/json_size)*100))

results <- rbind(results, data.frame(
  format = "CSV",
  file_size_mb = csv_size,
  compression_ratio = json_size / csv_size,
  load_time_est = "Fast",
  browser_compatible = "Yes (with parsing)",
  notes = "More compact, widely supported"
))

# 3. Compressed CSV (gzip)
cat("3. Testing compressed CSV (gzip)...\n")
csv_gz_file <- "test_format_data.csv.gz"
system(sprintf("gzip -c %s > %s", csv_file, csv_gz_file))
csv_gz_size <- file.size(csv_gz_file) / 1024 / 1024
cat(sprintf("   File size: %.2f MB (%.1f%% of JSON)\n", 
            csv_gz_size, (csv_gz_size/json_size)*100))

results <- rbind(results, data.frame(
  format = "CSV.GZ",
  file_size_mb = csv_gz_size,
  compression_ratio = json_size / csv_gz_size,
  load_time_est = "Fast",
  browser_compatible = "Yes (needs decompression)",
  notes = "Best file size, but needs decompression"
))

# 4. Parquet format (if arrow is available)
if (requireNamespace("arrow", quietly = TRUE)) {
  cat("4. Testing Parquet format...\n")
  parquet_file <- "test_format_data.parquet"
  tryCatch({
    arrow::write_parquet(prepare_data, parquet_file, compression = "snappy")
    parquet_size <- file.size(parquet_file) / 1024 / 1024
    cat(sprintf("   File size: %.2f MB (%.1f%% of JSON)\n", 
                parquet_size, (parquet_size/json_size)*100))
    
    results <- rbind(results, data.frame(
      format = "Parquet",
      file_size_mb = parquet_size,
      compression_ratio = json_size / parquet_size,
      load_time_est = "Very Fast",
      browser_compatible = "Limited (needs library)",
      notes = "Columnar format, excellent compression"
    ))
  }, error = function(e) {
    cat("   Could not create Parquet file\n")
  })
} else {
  cat("4. Parquet format: Not available (install 'arrow' package)\n")
}

# Display results
cat("\n=== Format Comparison Results ===\n\n")
results$file_size_mb <- round(results$file_size_mb, 2)
results$compression_ratio <- sprintf("%.2fx", results$compression_ratio)
print(results, row.names = FALSE)

# Extrapolate to full dataset
cat("\n=== Extrapolation to Full Dataset ===\n")
full_json_size <- 1768  # MB
size_per_record <- json_size / n_records

cat(sprintf("Full dataset JSON size: %.0f MB\n", full_json_size))
cat("\nEstimated sizes for full dataset (2.1M records):\n\n")

for (i in 1:nrow(results)) {
  format_name <- results$format[i]
  ratio <- as.numeric(gsub("x", "", results$compression_ratio[i]))
  estimated_full <- full_json_size / ratio
  browser_ok <- ifelse(estimated_full <= 500, "✓", "✗")
  
  cat(sprintf("  %s: %.0f MB %s\n", 
              format_name, 
              estimated_full,
              browser_ok))
}

cat("\n=== THE CRITICAL ISSUE ===\n")
cat("⚠ File size is only HALF the problem!\n\n")
cat("Even if we reduce file size:\n")
cat("  1. File must be downloaded: CSV helps here (smaller file)\n")
cat("  2. File must be parsed into JavaScript objects: Same memory needed\n")
cat("  3. Data must be stored in browser memory: Same memory needed\n")
cat("  4. Data must be manipulated for analysis: Same memory needed\n\n")

cat("Example with CSV:\n")
csv_full_estimate <- full_json_size * (csv_size / json_size)
cat(sprintf("  - CSV file: ~%.0f MB (download time: better!)\n", csv_full_estimate))
cat(sprintf("  - Parsed in memory: ~%.0f MB objects (same as JSON)\n", full_json_size * 1.5))
cat(sprintf("  - Working memory: ~%.0f MB (same as JSON)\n", full_json_size * 2))
cat(sprintf("  - Total memory: ~%.0f MB (still exceeds ~500 MB limit)\n", full_json_size * 3))

cat("\n=== SOLUTION SUMMARY ===\n\n")
cat("✓ CSV Format Helps With:\n")
cat("  - Faster download (smaller file)\n")
cat("  - Faster initial parsing\n")
cat("  - Better storage efficiency\n\n")

cat("✗ CSV Format Does NOT Help With:\n")
cat("  - JavaScript memory limits (same objects in memory)\n")
cat("  - Browser performance with large datasets\n")
cat("  - The fundamental 500 MB browser limit\n\n")

cat("✓ RECOMMENDED SOLUTIONS:\n")
cat("  1. Use medium dataset (~400 MB) - works in browser\n")
cat("  2. Implement streaming/chunking - complex but possible\n")
cat("  3. Use server-side processing - requires backend\n")
cat("  4. Use R directly for full dataset - most practical\n\n")

# Cleanup test files
cat("Cleaning up test files...\n")
file.remove(json_file, csv_file, csv_gz_file)
if (file.exists(parquet_file)) file.remove(parquet_file)

cat("\n=== CONCLUSION ===\n")
cat(sprintf("For full dataset (2.1M records, ~%.0f MB CSV):\n", csv_full_estimate))
cat("  → Still too large for browser (needs ~2 GB memory)\n")
cat("  → Use 'create_medium_dataset.R' to create ~400 MB version\n")
cat("  → Or implement streaming CSV parser (see next script)\n\n")

cat("✓ Recommendation: Create medium dataset for best results\n")
