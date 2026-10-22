export type AttentionBucket = "high" | "medium" | "low";
export type AttentionTone = "danger" | "warning" | "success";

export function getAttentionLevel(score: number | null | undefined): {
  bucket: AttentionBucket;
  label: string;
  shortLabel: string;
  tone: AttentionTone;
} {
  const value = score ?? 0;

  if (value >= 7) {
    return {
      bucket: "high",
      label: "Needs attention",
      shortLabel: "Attention",
      tone: "danger",
    };
  }

  if (value >= 4) {
    return {
      bucket: "medium",
      label: "Worth reviewing",
      shortLabel: "Review",
      tone: "warning",
    };
  }

  return {
    bucket: "low",
    label: "Standard",
    shortLabel: "Standard",
    tone: "success",
  };
}
