# Verify PISA Data JSON Files
# Run this script to check if your JSON files are valid and properly formatted

library(jsonlite)

cat("=== PISA Data File Verification ===\n\n")

# Function to check a JSON file
check_json_file <- function(filename) {
  cat(sprintf("Checking: %s\n", filename))
  cat(sprintf("  %s\n", strrep("-", 40)))
  
  if (!file.exists(filename)) {
    cat(sprintf("  ✗ File does not exist!\n\n"))
    return(FALSE)
  }
  
  # Check file size
  file_size <- file.size(filename)
  file_size_mb <- file_size / 1024 / 1024
  cat(sprintf("  File size: %.2f MB\n", file_size_mb))
  
  if (file_size == 0) {
    cat("  ✗ File is EMPTY! Re-run prepare_pisa_data.R\n\n")
    return(FALSE)
  }
  
  # Try to read the JSON
  tryCatch({
    data <- fromJSON(filename)
    
    # Check structure
    if (!is.data.frame(data) && !is.list(data)) {
      cat("  ✗ Invalid data structure\n\n")
      return(FALSE)
    }
    
    # Convert to data frame if needed
    if (is.list(data)) {
      data <- as.data.frame(data)
    }
    
    n_records <- nrow(data)
    cat(sprintf("  ✓ Valid JSON with %s records\n", format(n_records, big.mark = ",")))
    
    # Check required fields
    required_fields <- c("country", "year", "achievement", "ses")
    missing_fields <- setdiff(required_fields, names(data))
    
    if (length(missing_fields) > 0) {
      cat(sprintf("  ✗ Missing required fields: %s\n", paste(missing_fields, collapse = ", ")))
      return(FALSE)
    }
    
    cat("  ✓ All required fields present\n")
    
    # Show data summary
    countries <- unique(data$country)
    years <- unique(data$year)
    
    cat(sprintf("  Countries: %d (%s)\n", 
                length(countries), 
                paste(head(sort(countries), 5), collapse = ", ")))
    if (length(countries) > 5) cat(sprintf("              ... and %d more\n", length(countries) - 5))
    
    cat(sprintf("  Years: %s\n", paste(sort(years), collapse = ", ")))
    cat(sprintf("  Achievement range: %.0f - %.0f\n", 
                min(data$achievement, na.rm = TRUE), 
                max(data$achievement, na.rm = TRUE)))
    cat(sprintf("  SES range: %.2f - %.2f\n", 
                min(data$ses, na.rm = TRUE), 
                max(data$ses, na.rm = TRUE)))
    
    cat("  ✓ File is VALID and ready to use!\n\n")
    return(TRUE)
    
  }, error = function(e) {
    cat(sprintf("  ✗ Error reading JSON: %s\n\n", e$message))
    return(FALSE)
  })
}

# Check both files
sample_valid <- check_json_file("pisa_data_sample.json")
full_valid <- check_json_file("pisa_data.json")

cat("\n=== Summary ===\n")
if (sample_valid) {
  cat("✓ Sample file is ready to use with the HTML application\n")
} else {
  cat("✗ Sample file has issues - re-run prepare_pisa_data.R\n")
}

if (full_valid) {
  cat("✓ Full dataset is ready to use with the HTML application\n")
} else {
  cat("✗ Full dataset has issues - re-run prepare_pisa_data.R\n")
}

cat("\n=== Next Steps ===\n")
if (sample_valid || full_valid) {
  cat("1. Open educational_inequality_explorer_fixed.html in your browser\n")
  cat("2. Click 'Load PISA Data File'\n")
  if (sample_valid) {
    cat("3. Select pisa_data_sample.json to test (recommended first)\n")
  }
  if (full_valid) {
    cat("4. Select pisa_data.json for the full dataset\n")
  }
} else {
  cat("1. Re-run prepare_pisa_data.R completely\n")
  cat("2. Wait for the 'Export Complete' message\n")
  cat("3. Run this verification script again\n")
}

cat("\n")
