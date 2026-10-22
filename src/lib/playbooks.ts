export type PlaybookId = "consumer_app" | "saas_vendor" | "contractor"

export const PLAYBOOK_IDS: PlaybookId[] = ["consumer_app", "saas_vendor", "contractor"]

export const PLAYBOOKS: Record<PlaybookId, { label: string; topics: string[] }> = {
  consumer_app: {
    label: "Consumer app",
    topics: ["Data sharing", "Auto-renewal", "Arbitration", "Account termination"],
  },
  saas_vendor: {
    label: "SaaS vendor",
    topics: ["Data processing", "Liability cap", "Indemnification", "Termination for convenience", "Price change", "DPA / audit"],
  },
  contractor: {
    label: "Contractor / services",
    topics: ["IP assignment", "Non-solicit", "Payment", "Termination"],
  },
}

export function isPlaybookId(value: string): value is PlaybookId {
  return PLAYBOOK_IDS.includes(value as PlaybookId)
}

export function getAllPresetTopics(): Set<string> {
  const topics = new Set<string>()
  for (const playbook of Object.values(PLAYBOOKS)) {
    for (const topic of playbook.topics) {
      topics.add(topic)
    }
  }
  return topics
}

/** Replace preset topics with the chosen playbook; keep custom topics outside any preset. */
export function mergePlaybookTopics(playbookId: PlaybookId, existingClauses: string[]): string[] {
  const presetSet = getAllPresetTopics()
  const customClauses = existingClauses.filter((clause) => !presetSet.has(clause))
  return [...PLAYBOOKS[playbookId].topics, ...customClauses]
}
