/*
 * Answer options for the US job-search questions. Each stored value is the
 * start of the wording common ATS forms use, because the auto-apply engine
 * (engine._fuzzy_match_choice) matches stored answers to real form options
 * by prefix or whole word. Change a value only together with the engine.
 */

export const YES_NO = ["Yes", "No"] as const

export const GENDER = ["Male", "Female", "Non-binary", "Decline to self-identify"] as const

export const RACE_ETHNICITY = [
  "Hispanic or Latino",
  "White",
  "Black or African American",
  "Asian",
  "Native Hawaiian or Other Pacific Islander",
  "American Indian or Alaska Native",
  "Two or More Races",
  "Decline to self-identify",
] as const

export const VETERAN_STATUS = [
  "I am not a protected veteran",
  "I identify as one or more of the classifications of protected veteran",
  "I don't wish to answer",
] as const

export const DISABILITY_STATUS = [
  "Yes, I have a disability (or previously had a disability)",
  "No, I do not have a disability and have not had one in the past",
  "I don't wish to answer",
] as const

export const WORK_MODES = ["Remote", "Hybrid", "On-site"] as const

export const EXPERIENCE_YEARS = ["0–1", "1–3", "3–5", "5–8", "8–12", "12+"] as const

/** Seniority tiers, lowest first (spec 014). Same order as TIERS in scripts/ats/requirements.py. */
export const TARGET_LEVELS = ["New Grad", "Entry / Junior", "Mid Level", "Senior", "Staff", "VP"] as const

/** The level a candidate is assumed to target until they pick one. */
export const DEFAULT_LEVEL: Record<(typeof EXPERIENCE_YEARS)[number], (typeof TARGET_LEVELS)[number]> = {
  "0–1": "New Grad",
  "1–3": "Entry / Junior",
  "3–5": "Mid Level",
  "5–8": "Senior",
  "8–12": "Staff",
  "12+": "Staff",
}

export const HIGHEST_DEGREE = ["High school or none", "Associate", "Bachelor’s", "Master’s", "PhD"] as const

/** EEO answers default to declining; the candidate opts in to sharing. */
export const EEO_DEFAULTS = {
  gender: "Decline to self-identify",
  raceEthnicity: "Decline to self-identify",
  veteranStatus: "I don't wish to answer",
  disabilityStatus: "I don't wish to answer",
} as const
