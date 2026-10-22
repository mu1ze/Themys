import {
  FileText,
  Flag,
  LayoutGrid,
  MessageSquare,
  Shield,
} from "lucide-react";
import type { WorkspacePanel } from "@/lib/scan-results-workspace";

export const WORKSPACE_NAV: {
  id: WorkspacePanel;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof FileText;
  countKey?: "flagged" | "suggestions" | "compliance";
  countTone?: "rose" | "amber" | "blue";
}[] = [
  {
    id: "summary",
    label: "Summary",
    shortLabel: "Summary",
    description: "Executive overview and key findings",
    icon: FileText,
  },
  {
    id: "flagged",
    label: "Flagged",
    shortLabel: "Flagged",
    description: "Clauses that need review, sorted by impact",
    icon: Flag,
    countKey: "flagged",
    countTone: "rose",
  },
  {
    id: "suggestions",
    label: "Actionable Insights",
    shortLabel: "Insights",
    description: "Steps you can start now and concrete asks to make",
    icon: MessageSquare,
    countKey: "suggestions",
    countTone: "amber",
  },
  {
    id: "compliance",
    label: "Compliance",
    shortLabel: "Comply",
    description: "Regulatory framework scores and article links",
    icon: Shield,
    countKey: "compliance",
    countTone: "blue",
  },
  {
    id: "extraction",
    label: "Extraction",
    shortLabel: "Extract",
    description: "All sections extracted from the source document",
    icon: LayoutGrid,
  },
  {
    id: "document",
    label: "Full Document",
    shortLabel: "Document",
    description: "Read the complete original wording",
    icon: FileText,
  },
];
