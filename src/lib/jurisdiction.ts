import type { RiskCategory } from "@/lib/analysis-engine";

export type JurisdictionContext = {
  country: string | null;
  state: string | null;
  label: string | null;
  normalizedCountry: string | null;
  normalizedState: string | null;
  isSet: boolean;
};

export type JurisdictionImpact = {
  level: "high" | "medium" | "low";
  label: string;
  score: number;
  note: string;
};

const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "u.s.": "US",
  us: "US",
  america: "US",
  canada: "CA",
  ca: "CA",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  gb: "GB",
  "european union": "EU",
  eu: "EU",
  australia: "AU",
  au: "AU",
};

const STATE_ALIASES: Record<string, string> = {
  california: "CA",
  ca: "CA",
  "new york": "NY",
  ny: "NY",
  texas: "TX",
  tx: "TX",
  florida: "FL",
  fl: "FL",
  ontario: "ON",
  on: "ON",
  quebec: "QC",
  qc: "QC",
  "british columbia": "BC",
  bc: "BC",
  "new south wales": "NSW",
  nsw: "NSW",
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.replace(/\s+/g, " ") : null;
}

function normalizeCountry(value: string | null | undefined): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const alias = COUNTRY_ALIASES[text.toLowerCase()];
  return alias ?? text.toUpperCase();
}

function normalizeState(value: string | null | undefined): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const alias = STATE_ALIASES[text.toLowerCase()];
  return alias ?? text.toUpperCase();
}

function displayLabel(value: string | null | undefined): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (text.length <= 3) return text.toUpperCase();

  return text
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function riskPrioritySummary(jurisdiction: JurisdictionContext): string {
  if (jurisdiction.normalizedCountry === "US" && jurisdiction.normalizedState === "CA") {
    return "privacy disclosures, auto-renewal terms, and data-sharing rights";
  }

  if (jurisdiction.normalizedCountry === "US") {
    return "privacy disclosures, billing language, and dispute terms";
  }

  if (jurisdiction.normalizedCountry === "CA") {
    return "privacy disclosures, sharing limits, and billing terms";
  }

  if (jurisdiction.normalizedCountry === "GB" || jurisdiction.normalizedCountry === "EU") {
    return "privacy disclosures, tracking language, and consent rights";
  }

  if (jurisdiction.normalizedCountry === "AU") {
    return "privacy disclosures, billing language, and consumer rights";
  }

  return "privacy disclosures, billing language, and dispute terms";
}

export function buildJurisdictionContext(
  country: string | null | undefined,
  state: string | null | undefined
): JurisdictionContext {
  const normalizedCountry = normalizeCountry(country);
  const normalizedState = normalizeState(state);

  const countryLabel = displayLabel(country);
  const stateLabel = displayLabel(state);

  return {
    country: normalizeText(country),
    state: normalizeText(state),
    label: [countryLabel, stateLabel].filter(Boolean).join(", ") || null,
    normalizedCountry,
    normalizedState,
    isSet: Boolean(normalizedCountry || normalizedState),
  };
}

function jurisdictionPriority(jurisdiction: JurisdictionContext): Partial<Record<RiskCategory, number>> {
  if (jurisdiction.normalizedCountry === "US" && jurisdiction.normalizedState === "CA") {
    return {
      data_sharing: 3,
      auto_renewal: 3,
      location_tracking: 3,
      no_opt_out: 3,
      arbitration: 2,
      class_waiver: 2,
      termination: 1,
      content_license: 0,
    };
  }

  if (jurisdiction.normalizedCountry === "US") {
    return {
      data_sharing: 2,
      auto_renewal: 3,
      location_tracking: 2,
      no_opt_out: 2,
      arbitration: 2,
      class_waiver: 2,
      termination: 1,
      content_license: 0,
    };
  }

  if (jurisdiction.normalizedCountry === "CA") {
    return {
      data_sharing: 3,
      auto_renewal: 2,
      location_tracking: 2,
      no_opt_out: 2,
      arbitration: 1,
      class_waiver: 1,
      termination: 1,
      content_license: 0,
    };
  }

  if (jurisdiction.normalizedCountry === "GB" || jurisdiction.normalizedCountry === "EU") {
    return {
      data_sharing: 3,
      auto_renewal: 2,
      location_tracking: 3,
      no_opt_out: 2,
      arbitration: 1,
      class_waiver: 1,
      termination: 1,
      content_license: 0,
    };
  }

  if (jurisdiction.normalizedCountry === "AU") {
    return {
      data_sharing: 2,
      auto_renewal: 2,
      location_tracking: 2,
      no_opt_out: 2,
      arbitration: 1,
      class_waiver: 1,
      termination: 1,
      content_license: 0,
    };
  }

  return {};
}

function levelFromScore(score: number): JurisdictionImpact["level"] {
  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function labelForLevel(level: JurisdictionImpact["level"]): string {
  if (level === "high") return "Matters most";
  if (level === "medium") return "Worth a look";
  return "Lower impact";
}

function noteForLevel(level: JurisdictionImpact["level"], jurisdiction: JurisdictionContext): string {
  const region = jurisdiction.label ? `for ${jurisdiction.label}` : "for your location";

  if (level === "high") {
    return `This clause can change the rights or tradeoffs that matter most ${region}.`;
  }

  if (level === "medium") {
    return `This clause may matter ${region}, but it is usually less central than privacy, billing, or dispute terms.`;
  }

  return `This clause is less likely to change the rights most affected by local consumer rules ${region}.`;
}

export function getClauseJurisdictionImpact(
  category: RiskCategory,
  jurisdiction: JurisdictionContext
): JurisdictionImpact {
  const priority = jurisdictionPriority(jurisdiction)[category] ?? 0;
  const level = levelFromScore(priority);

  return {
    level,
    label: labelForLevel(level),
    score: priority,
    note: noteForLevel(level, jurisdiction),
  };
}

export function getJurisdictionSummary(jurisdiction: JurisdictionContext): string {
  if (!jurisdiction.isSet) {
    return "Set your country and state in Settings to compare scans against local rights and restrictions.";
  }

  return `Localized for ${jurisdiction.label}. We surface clauses that can affect ${riskPrioritySummary(
    jurisdiction
  )} where you live.`;
}
