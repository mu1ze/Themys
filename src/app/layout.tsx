import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/lib/theme-context";
import { getAppOrigin } from "@/lib/app-origin";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  weight: "400",
});

const siteUrl = getAppOrigin();

export const metadata: Metadata = {
  title: {
    default: "Themys",
    template: "%s | Themys",
  },
  description:
    "Scan terms of service, surface risky clauses, and keep a plain-English record of every service you review.",
  metadataBase: new URL(siteUrl),
  applicationName: "Themys",
  keywords: [
    "Terms of Service analyzer",
    "ToS scanner",
    "privacy policy reader",
    "legal tech",
    "contract analysis",
  ],
  authors: [{ name: "Themys" }],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.svg",
  },
  openGraph: {
    title: "Themys",
    description: "Know what you agree to — scan any Terms of Service in seconds.",
    siteName: "Themys",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: "/themys-og.png",
        width: 1200,
        height: 630,
        alt: "Themys — Know what you agree to",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Themys",
    description: "Know what you agree to — scan any Terms of Service in seconds.",
    creator: "@themys",
    images: [
      {
        url: "/themys-og.png",
        alt: "Themys — Know what you agree to",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('themys-theme');document.documentElement.classList.add(t==='dark'?'theme-dark':'theme-light');}catch(e){document.documentElement.classList.add('theme-light');}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${sourceSerif.variable} min-h-full bg-background text-foreground antialiased`}>
        <ClerkProvider
          dynamic
          appearance={{ cssLayerName: "clerk" }}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
        >
          <ThemeProvider>
            <div className="flex min-h-screen flex-col bg-[var(--ds-bg)] text-[var(--ds-text)] transition-colors duration-300">
              <SiteHeader />
              <main className="flex-1">{children}</main>
            </div>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
