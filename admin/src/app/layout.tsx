import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/lib/theme-context";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Admin — Themys",
    template: "%s | Themys Admin",
  },
  description: "Themys admin panel — manage users, scans, revenue, and system health.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased admin-surface" style={{ background: "var(--ds-bg)", color: "var(--ds-text)" }}>
        <ClerkProvider
          dynamic
          signInUrl="/sign-in"
          signUpFallbackRedirectUrl="/"
        >
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
