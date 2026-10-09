import { DEFAULT_LEVEL } from "./options"
import type { OnboardingData } from "./schema"
import type { StoredProfile } from "./store"

// Profiles saved before spec 014 have no target level yet.
const levelDefault = (years: string) => DEFAULT_LEVEL[years as OnboardingData["yearsExperience"]]

/**
 * The stored profile as onboarding form data, for My Details. The exact
 * inverse of saveProfile() in store.ts, so saving it back changes nothing
 * the candidate didn't edit.
 */
export function profileToDraft(p: StoredProfile): Partial<OnboardingData> {
  const resumeId = /resumes\/([0-9a-f-]{36})\.pdf$/.exec(p.resume_pdf)?.[1] ?? ""
  return {
    resumeId,
    resumeFileName: p.resume_filename,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    phone: p.phone,
    location: p.location,
    linkedinUrl: p.linkedin_url,
    githubUrl: p.github_url,
    portfolioUrl: p.portfolio_url,
    targetTitles: p.target_job_title,
    targetLocations: p.target_locations,
    workModes: p.work_modes as OnboardingData["workModes"],
    currentTitle: p.job_title,
    yearsExperience: p.years_experience as OnboardingData["yearsExperience"],
    targetLevel: (p.target_level || levelDefault(p.years_experience)) as OnboardingData["targetLevel"],
    highestDegree: (p.highest_degree || undefined) as OnboardingData["highestDegree"],
    desiredSalary: p.desired_salary,
    earliestStartDate: p.earliest_start_date,
    skills: p.resume_skills,
    workAuthorization: p.work_authorization as OnboardingData["workAuthorization"],
    needsSponsorship: p.needs_sponsorship as OnboardingData["needsSponsorship"],
    gender: p.gender as OnboardingData["gender"],
    raceEthnicity: p.race_ethnicity as OnboardingData["raceEthnicity"],
    veteranStatus: p.veteran_status as OnboardingData["veteranStatus"],
    disabilityStatus: p.disability_status as OnboardingData["disabilityStatus"],
  }
}
