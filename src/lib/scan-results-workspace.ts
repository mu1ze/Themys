export const WORKSPACE_PANELS = [
  "summary",
  "flagged",
  "suggestions",
  "compliance",
  "extraction",
  "document",
] as const;

export type WorkspacePanel = (typeof WORKSPACE_PANELS)[number];

export const RAIL_COLLAPSED_KEY = "themys_rail_collapsed";
export const WORKSPACE_CUSTOMIZE_KEY = "themys_customize_ws";
export type WorkspaceSectionKey = "bottomline" | "topitem" | "fulldoc" | "stats";

export const DEFAULT_WORKSPACE_SECTIONS: Record<WorkspaceSectionKey, boolean> = {
  bottomline: true,
  topitem: true,
  fulldoc: true,
  stats: true,
};

/** Scan risk scores are stored on a 0–10 scale; the workspace displays 0–100. */
export function toAttentionScore100(score: number | null | undefined): number {
  const value = score ?? 0;
  if (value > 10) return Math.round(Math.min(100, Math.max(0, value)));
  return Math.round(Math.min(10, Math.max(0, value)) * 10);
}

export function clauseExcerpt(text: string, max = 140): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export function isWorkspacePanel(value: string): value is WorkspacePanel {
  return (WORKSPACE_PANELS as readonly string[]).includes(value);
}
