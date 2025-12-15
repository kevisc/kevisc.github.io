# harmonize_lsas.R
# Helpers to harmonize student-level microdata across PISA, TIMSS, PIRLS, PIAAC
suppressPackageStartupMessages({
  library(dplyr); library(stringr); library(purrr); library(tidyr)
  library(jsonlite); library(readr)
})

# --- utilities --------------------------------------------------------------

find_cols <- function(nms, patterns) {
  hits <- unique(unlist(lapply(patterns, function(p) grep(p, nms, ignore.case = TRUE, value = TRUE))))
  hits
}

pv_columns <- function(df, subject = c("MATH","READ","SCI","NUM","LIT")) {
  subject <- match.arg(subject)
  nms <- names(df)
  pats <- switch(subject,
    "MATH" = c("^PV\\d+MATH$", "^PV\\d+MATH_?\\w*$", "ASMMAT\\d{2}$", "BSMMAT\\d{2}$"),
    "READ" = c("^PV\\d+(READ|READING)$", "ASRREA\\d{2}$", "BSRREA\\d{2}$"),
    "SCI"  = c("^PV\\d+SCIE$", "ASSSCI\\d{2}$", "BSSSCI\\d{2}$"),
    "NUM"  = c("^PV\\d+NUM$"),
    "LIT"  = c("^PV\\d+LIT$")
  )
  hits <- find_cols(nms, pats)
  df[, hits, drop = FALSE]
}

collapse_pvs <- function(pv_df, method = c("mean","pv1")) {
  method <- match.arg(method)
  if (is.null(pv_df) || ncol(pv_df) == 0L) return(NULL)
  if (method == "pv1") return(pv_df[[1]])
  rowMeans(pv_df, na.rm = TRUE)
}

z_within_groups <- function(x, g1, g2) {
  df <- data.frame(x, g1, g2)
  df |>
    group_by(g1, g2) |>
    mutate(z = (x - mean(x, na.rm=TRUE))/sd(x, na.rm=TRUE)) |>
    pull(z)
}

first_numeric <- function(df, candidates_regex) {
  nms <- names(df)
  hits <- find_cols(nms, candidates_regex)
  hits <- hits[ vapply(df[hits], is.numeric, logical(1)) ]
  if (length(hits) == 0) return(NULL)
  df[[hits[1]]]
}

standardize_gender <- function(df) {
  if ("ST004D01T" %in% names(df)) {
    g <- toupper(as.character(df$ST004D01T))
    return(ifelse(g %in% c("FEMALE","2"), 1L, ifelse(g %in% c("MALE","1"), 0L, NA_integer_)))
  }
  if ("ITSEX" %in% names(df)) {
    return(ifelse(df$ITSEX == 1, 1L, ifelse(df$ITSEX == 2, 0L, NA_integer_)))
  }
  if ("GENDER_R" %in% names(df)) {
    return(ifelse(df$GENDER_R == 2, 1L, ifelse(df$GENDER_R == 1, 0L, NA_integer_)))
  }
  if ("GENDER" %in% names(df)) {
    g <- toupper(as.character(df$GENDER))
    return(ifelse(g %in% c("FEMALE","F","WOMAN"), 1L, ifelse(g %in% c("MALE","M","MAN"), 0L, NA_integer_)))
  }
  rep(NA_integer_, nrow(df))
}

standardize_immigrant <- function(df) {
  if ("IMMIG" %in% names(df)) return(ifelse(df$IMMIG %in% c(2,3), 1L, ifelse(df$IMMIG %in% c(1), 0L, NA_integer_)))
  nms <- names(df); hits <- grep("^(A|B)SBGIMMIG$", nms, value = TRUE)
  if (length(hits)) { v <- df[[hits[1]]]; return(ifelse(v %in% c(2,3), 1L, ifelse(v %in% c(1), 0L, NA_integer_))) }
  rep(NA_integer_, nrow(df))
}

parent_edu_proxy <- function(df) {
  if ("HISCED" %in% names(df)) return(suppressWarnings(as.numeric(df$HISCED)))
  if ("PARED"  %in% names(df)) return(suppressWarnings(as.numeric(df$PARED)))
  nms <- names(df); hits <- grep("^(A|B)SBGHISCED$", nms, value=TRUE)
  if (length(hits)) return(suppressWarnings(as.numeric(df[[hits[1]]])))
  rep(NA_real_, nrow(df))
}

build_ses <- function(df, assessment, year, country) {
  if ("ESCS" %in% names(df) && is.numeric(df$ESCS)) {
    return(z_within_groups(df$ESCS, assessment, year))
  }
  proxy <- NULL
  if ("HISEI" %in% names(df) && is.numeric(df$HISEI)) proxy <- df$HISEI
  if (is.null(proxy)) proxy <- parent_edu_proxy(df)
  if (is.null(proxy)) {
    nms <- names(df); hits <- grep("BOOK", nms, ignore.case=TRUE, value=TRUE)
    hits <- hits[ vapply(df[hits], is.numeric, logical(1)) ]
    if (length(hits)) proxy <- df[[hits[1]]]
  }
  if (!is.null(proxy)) return(z_within_groups(proxy, assessment, year))
  rep(NA_real_, nrow(df))
}

collect_weights <- function(df) {
  sw <- if ("W_FSTUWT" %in% names(df)) df$W_FSTUWT else if ("TOTWGT" %in% names(df)) df$TOTWGT else rep(1, nrow(df))
  sen <- if ("W_FSENWT" %in% names(df)) df$W_FSENWT else sw
  repl <- names(df)[grepl("^W_FSTR\\d+$", names(df)) | grepl("^RW\\d+$", names(df)) | grepl("^JK\\d+$", names(df))]
  list(studentWeight = sw, senateWeight = sen, replicateWeights = if (length(repl)) df[repl] else NULL)
}

make_uniform <- function(raw, assessment, cycle_label, pv_subject = "READ", pv_method = "mean",
                         id_country = c("CNT","CNTRYID","COUNTRY","LOCATION"),
                         id_school  = c("SCHOOLID","IDSCHOOL","IDCNTSCH"),
                         id_student = c("STIDSTD","IDSTUD","IDCNTSRS")) {

  pick_field <- function(cands) { hit <- cands[cands %in% names(raw)][1]; if (is.na(hit)) NA_character_ else hit }

  cf <- pick_field(id_country)
  sf <- pick_field(id_school)
  stf<- pick_field(id_student)

  country <- if (!is.na(cf)) raw[[cf]] else NA
  year    <- if ("YEAR" %in% names(raw)) raw$YEAR else cycle_label

  pvs <- pv_columns(raw, pv_subject)
  ach <- collapse_pvs(pvs, pv_method)

  ses <- build_ses(raw, assessment, year, country)

  gender    <- standardize_gender(raw)
  immigrant <- standardize_immigrant(raw)
  parentEdu <- parent_edu_proxy(raw)

  W <- collect_weights(raw)

  schoolId  <- if (!is.na(sf)) as.character(raw[[sf]]) else NA_character_
  studentId <- if (!is.na(stf)) as.character(raw[[stf]]) else sprintf("%s_%s_%s_%06d", assessment, country[1], year[1], seq_len(nrow(raw)))

  out <- tibble::tibble(
    assessment = assessment,
    subject    = pv_subject,
    country    = as.character(country),
    year       = as.integer(year),
    studentId  = studentId,
    schoolId   = schoolId,
    achievement = as.numeric(ach),
    ses         = as.numeric(ses),
    gender      = as.integer(gender),
    immigrant   = as.integer(immigrant),
    parentEdu   = as.numeric(parentEdu),
    studentWeight = as.numeric(W$studentWeight),
    senateWeight  = as.numeric(W$senateWeight)
  )

  if (!is.null(W$replicateWeights)) {
    out <- bind_cols(out, W$replicateWeights)
  }

  out
}

write_outputs <- function(df, file_stem, sample_per_cy = 10000L) {
  df_small <- df |>
    group_by(assessment, country, year) |>
    dplyr::slice_sample(n = min(dplyr::n(), sample_per_cy)) |>
    ungroup()

  readr::write_csv(df_small, paste0(file_stem, ".csv"))
  jsonlite::write_json(df_small, paste0(file_stem, ".json"), dataframe = "rows", auto_unbox = TRUE)

  msg_n <- format(nrow(df_small), big.mark = ",")
  message(sprintf("Wrote: %s.{csv,json} (n=%s).", file_stem, msg_n))
  invisible(df_small)
}
