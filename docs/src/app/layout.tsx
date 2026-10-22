import type { Metadata } from "next";
import { DocsShell } from "./docs-shell";
import { ThemeProvider } from "@/lib/theme-context";

import "./globals.css";

export const metadata: Metadata = {
  title: "Documentation | Themys",
  description: "Learn how to use Themys to scan and understand Terms of Service.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-dark">
      <body>
        <ThemeProvider>
          <DocsShell>{children}</DocsShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
