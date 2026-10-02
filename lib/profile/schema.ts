import { z } from "zod"

import {
  DISABILITY_STATUS,
  EXPERIENCE_YEARS,
  GENDER,
  RACE_ETHNICITY,
  VETERAN_STATUS,
  WORK_MODES,
  YES_NO,
} from "./options"

const optionalUrl = z.union([z.literal(""), z.url("Enter a full link, starting with https://")])

/** One schema per onboarding step, so Continue validates only what's on screen. */
export const stepSchemas = {
  resume: z.object({
    resumeId: z.string().min(1, "Upload your resume to continue"),
    resumeFileName: z.string(),
  }),
  about: z.object({
    firstName: z.string().trim().min(1, "Required"),
    lastName: z.string().trim().min(1, "Required"),
    email: z.email("Enter a valid email"),
    phone: z.string().trim().regex(/^[+()\d\s.-]{7,20}$/, "Enter a valid phone number"),
    location: z.string().trim().min(2, "Required"),
  }),
  links: z.object({
    linkedinUrl: optionalUrl,
    githubUrl: optionalUrl,
    portfolioUrl: optionalUrl,
  }),
  preferences: z.object({
    targetTitles: z.array(z.string().trim().min(1)).min(1, "Add at least one job title"),
    targetLocations: z.array(z.string().trim().min(1)),
    workModes: z.array(z.enum(WORK_MODES)).min(1, "Pick at least one"),
    currentTitle: z.string().trim(),
    yearsExperience: z.enum(EXPERIENCE_YEARS, "Pick one"),
    desiredSalary: z.string().trim(),
    earliestStartDate: z.string().trim(),
  }),
  skills: z.object({
    skills: z.array(z.string()).min(3, "Keep at least 3 skills so we can match jobs"),
  }),
  authorization: z.object({ workAuthorization: z.enum(YES_NO, "Choose an answer") }),
  sponsorship: z.object({ needsSponsorship: z.enum(YES_NO, "Choose an answer") }),
  eeo: z.object({
    gender: z.enum(GENDER),
    raceEthnicity: z.enum(RACE_ETHNICITY),
    veteranStatus: z.enum(VETERAN_STATUS),
    disabilityStatus: z.enum(DISABILITY_STATUS),
  }),
}

export const onboardingSchema = z.object({
  ...stepSchemas.resume.shape,
  ...stepSchemas.about.shape,
  ...stepSchemas.links.shape,
  ...stepSchemas.preferences.shape,
  ...stepSchemas.skills.shape,
  ...stepSchemas.authorization.shape,
  ...stepSchemas.sponsorship.shape,
  ...stepSchemas.eeo.shape,
})

export type OnboardingData = z.infer<typeof onboardingSchema>
export type StepKey = keyof typeof stepSchemas

/** What POST /api/resume returns. */
export interface ParsedResume {
  resumeId: string
  fileName: string
  skills: string[]
  contact: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    linkedinUrl?: string
    githubUrl?: string
    portfolioUrl?: string
  }
}
