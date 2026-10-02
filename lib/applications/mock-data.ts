import type {
  Application,
  ApplicationStatus,
  Ats,
  ResolutionAction,
  Sponsorship,
} from "./types"

/*
 * Synthetic demo data standing in for the Supabase job_matches table until
 * spec 003 (schema) lands. Companies are fictional. Dates are pinned to a
 * fixed "now" so server and client render identical relative times.
 */
export const DEMO_NOW = new Date("2026-09-29T16:00:00Z")

/** Plan shown in the dashboard header until pricing is decided (tracker Open Questions). */
export const DEMO_CANDIDATE = { plan: "Performance Plan" }

type Row = [
  company: string,
  role: string,
  location: string,
  ats: Ats,
  match: number,
  sponsorship: Sponsorship,
  status: ApplicationStatus,
  hoursAgo: number,
  reason?: keyof typeof REASONS,
]

const REASONS = {
  closed: {
    text: "Posting closed. Greenhouse returned “This job is no longer accepting applications” on submit.",
    action: "dismiss",
  },
  workdayAccount: {
    text: "Workday requires a candidate account for this employer. Automated apply can’t create or sign in to one.",
    action: "dismiss",
  },
  captcha: {
    text: "CAPTCHA wasn’t completed after 3 attempts. Nothing was submitted.",
    action: "retry",
  },
  timeout: {
    text: "Lever form stopped responding while uploading your resume. Nothing was submitted.",
    action: "retry",
  },
  relocate: {
    text: "Screening question needs your answer: “Are you willing to relocate to Austin, TX?”",
    action: "answer",
  },
  salary: {
    text: "Required field “Desired salary (USD)” has no value in your profile.",
    action: "update_profile",
  },
  sponsorshipFormat: {
    text: "Sponsorship question uses a format we don’t recognize. Your stored answer is “Yes”. Confirm it before we submit.",
    action: "answer",
  },
  portfolio: {
    text: "Required field “Portfolio URL” has no value in your profile.",
    action: "update_profile",
  },
} satisfies Record<string, { text: string; action: ResolutionAction }>

const ROWS: Row[] = [
  ["Copperleaf Software", "Senior Frontend Engineer", "Remote (US)", "Ashby", 91, "offered", "applying", 0.1],
  ["Tidewater Analytics", "Software Engineer II, Web", "Boston, MA", "Greenhouse", 84, "offered", "queued", 0.2],
  ["Kestrel Security", "Frontend Engineer, Platform", "Remote (US)", "Lever", 78, "unknown", "queued", 0.3],
  ["Juniper Commerce", "React Engineer", "Chicago, IL", "Greenhouse", 72, "not_offered", "queued", 0.4],
  ["Arcadia Robotics", "Software Engineer, Fleet UI", "Austin, TX", "Greenhouse", 81, "offered", "needs_review", 3, "relocate"],
  ["Meridian Bank", "Senior UI Engineer", "Charlotte, NC", "Workday", 69, "offered", "needs_review", 5, "sponsorshipFormat"],
  ["Orbital Pay", "Frontend Engineer", "New York, NY", "Lever", 88, "offered", "applied", 6],
  ["Northwind Labs", "Full Stack Engineer", "Remote (US)", "Ashby", 76, "unknown", "applied", 8],
  ["Halcyon Health", "Software Engineer, Patient Apps", "Seattle, WA", "Greenhouse", 74, "offered", "failed", 20, "captcha"],
  ["Sable Systems", "UI Engineer", "Denver, CO", "Lever", 67, "not_offered", "applied", 22],
  ["Lumen Grid", "Frontend Developer", "Remote (US)", "Greenhouse", 63, "unknown", "applied", 26],
  ["Waypoint Logistics", "Senior Software Engineer, Web", "Atlanta, GA", "Workday", 71, "offered", "failed", 28, "workdayAccount"],
  ["Parcel & Pine", "Product Engineer", "Portland, OR", "Ashby", 83, "offered", "applied", 30],
  ["Fieldstone Insurance", "Frontend Engineer II", "Columbus, OH", "Workday", 58, "offered", "applied", 45],
  ["Cinder Games", "Web Platform Engineer", "Los Angeles, CA", "Greenhouse", 66, "not_offered", "applied", 49],
  ["Brightline Freight", "Software Engineer, Customer Portal", "Dallas, TX", "Lever", 70, "offered", "needs_review", 52, "salary"],
  ["Copperleaf Software", "Frontend Engineer, Growth", "Remote (US)", "Ashby", 79, "offered", "applied", 54],
  ["Orbital Pay", "Design Systems Engineer", "New York, NY", "Lever", 86, "offered", "applied", 70],
  ["Tidewater Analytics", "Data Visualization Engineer", "Boston, MA", "Greenhouse", 61, "offered", "failed", 74, "closed"],
  ["Halcyon Health", "Senior Frontend Engineer", "Seattle, WA", "Greenhouse", 77, "offered", "applied", 76],
  ["Kestrel Security", "Software Engineer, Console", "Remote (US)", "Lever", 73, "unknown", "applied", 95],
  ["Northwind Labs", "Senior Software Engineer", "Remote (US)", "Ashby", 68, "unknown", "applied", 98],
  ["Juniper Commerce", "Frontend Engineer, Checkout", "Chicago, IL", "Greenhouse", 64, "not_offered", "applied", 100],
  ["Arcadia Robotics", "Frontend Engineer, Tools", "Austin, TX", "Greenhouse", 75, "offered", "applied", 118],
  ["Meridian Bank", "Software Engineer, Digital Banking", "Charlotte, NC", "Workday", 57, "offered", "failed", 122, "workdayAccount"],
  ["Sable Systems", "Frontend Engineer, Observability", "Denver, CO", "Lever", 82, "not_offered", "applied", 126],
  ["Lumen Grid", "Software Engineer, Energy Dashboards", "Remote (US)", "Greenhouse", 60, "unknown", "applied", 142],
  ["Parcel & Pine", "Frontend Engineer", "Portland, OR", "Ashby", 80, "offered", "applied", 146],
  ["Cinder Games", "Tools Engineer, Web", "Los Angeles, CA", "Greenhouse", 55, "not_offered", "failed", 150, "timeout"],
  ["Waypoint Logistics", "UI Engineer", "Atlanta, GA", "Workday", 62, "offered", "applied", 166],
  ["Brightline Freight", "Frontend Engineer", "Dallas, TX", "Lever", 69, "offered", "applied", 170],
  ["Fieldstone Insurance", "Senior Frontend Engineer", "Columbus, OH", "Workday", 65, "offered", "applied", 190],
  ["Orbital Pay", "Software Engineer, Merchant Dashboard", "New York, NY", "Lever", 85, "offered", "applied", 194],
  ["Copperleaf Software", "Software Engineer, Editor", "Remote (US)", "Ashby", 87, "offered", "applied", 214],
  ["Tidewater Analytics", "Frontend Engineer", "Boston, MA", "Greenhouse", 59, "offered", "needs_review", 218, "portfolio"],
  ["Halcyon Health", "Frontend Engineer, Scheduling", "Seattle, WA", "Greenhouse", 72, "offered", "applied", 238],
  ["Kestrel Security", "Senior UI Engineer", "Remote (US)", "Lever", 74, "unknown", "applied", 262],
  ["Northwind Labs", "Frontend Engineer", "Remote (US)", "Ashby", 70, "unknown", "applied", 266],
  ["Juniper Commerce", "Software Engineer, Storefront", "Chicago, IL", "Greenhouse", 52, "not_offered", "failed", 286, "closed"],
  ["Arcadia Robotics", "Web Engineer", "Austin, TX", "Greenhouse", 73, "offered", "applied", 290],
  ["Sable Systems", "Software Engineer, Frontend", "Denver, CO", "Lever", 63, "not_offered", "applied", 310],
  ["Parcel & Pine", "Software Engineer, Web", "Portland, OR", "Ashby", 78, "offered", "applied", 314],
]

const HOUR = 60 * 60 * 1000

function toApplication(row: Row, index: number): Application {
  const [company, role, location, ats, matchScore, sponsorship, status, hoursAgo, reasonKey] = row
  const updatedAt = new Date(DEMO_NOW.getTime() - hoursAgo * HOUR)
  const queuedAt = new Date(updatedAt.getTime() - (0.2 + (index % 5) * 0.15) * HOUR)
  const reason = reasonKey ? REASONS[reasonKey] : undefined
  const slug = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")

  return {
    id: `app_${String(index + 1).padStart(3, "0")}`,
    jobId: `job_${slug}`,
    company,
    role,
    location,
    ats,
    matchScore,
    sponsorship,
    status,
    reason: reason?.text,
    resolution: reason?.action,
    progress:
      status === "applying"
        ? { step: "Answering screening questions", current: 3, total: 5 }
        : undefined,
    queuedAt: queuedAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    postingUrl: `https://jobs.example.com/${slug}`,
  }
}

/** Same signature the Supabase-backed service will expose. */
export async function getApplications(): Promise<Application[]> {
  return ROWS.map(toApplication)
}
