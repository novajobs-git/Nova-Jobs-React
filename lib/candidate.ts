import "server-only"

/**
 * The signed-in candidate's id. Every Auto-Apply setting, queue and engine is
 * keyed by it. One demo candidate until Clerk (spec 008) supplies real user
 * ids; then this reads the session and nothing else changes.
 */
export async function currentCandidateId(): Promise<string> {
  return "candidate"
}
