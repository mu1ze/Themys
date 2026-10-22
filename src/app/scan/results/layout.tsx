import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function ScanResultsLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 h-dvh min-w-0 overflow-hidden">{children}</div>;
}
