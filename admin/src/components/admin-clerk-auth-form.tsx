"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

type ClerkAuthFormProps =
  | {
      mode: "sign-in";
      fallbackRedirectUrl: string;
      path: string;
      signUpUrl: string;
    }
  | {
      mode: "sign-up";
      fallbackRedirectUrl: string;
      path: string;
      signInUrl: string;
    };

function useClerkAppearance() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return {
    variables: {
      colorPrimary: isDark ? "#3b82f6" : "#2563eb",
      colorBackground: "transparent",
      fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      borderRadius: "0.75rem",
      colorForeground: isDark ? "#f8fafc" : "#0f172a",
      colorMutedForeground: isDark ? "#cbd5e1" : "#475569",
      colorInputForeground: isDark ? "#f8fafc" : "#0f172a",
      colorInput: isDark ? "#0f1729" : "#ffffff",
      colorNeutral: isDark ? "#64748b" : "#64748b",
      colorPrimaryForeground: "#ffffff",
      colorBorder: isDark ? "#1c2a47" : "#e2e8f0",
      colorRing: isDark ? "#60a5fa" : "#2563eb",
      colorDanger: isDark ? "#f87171" : "#dc2626",
      colorSuccess: isDark ? "#34d399" : "#059669",
      colorWarning: isDark ? "#fbbf24" : "#d97706",
    },
    elements: {
      rootBox: "w-full",
      cardBox: "!shadow-none !border-0 !bg-transparent",
      card: "shadow-none border-0 bg-transparent p-0",
      headerTitle: "hidden",
      headerSubtitle: "hidden",
      socialButtonsBlockButton:
        "border !border-[var(--ds-border)] rounded-lg h-11 font-medium hover:!bg-[var(--ds-card-hover)]",
      socialButtonsBlockButtonText:
        "!text-sm !text-[var(--ds-text-secondary)]",
      socialButtonsBlockButtonArrow:
        "!text-[var(--ds-text-muted)]",
      dividerLine: "!bg-[var(--ds-border)]",
      dividerText: "!text-xs !text-[var(--ds-text-muted)]",
      formFieldLabel:
        "!text-sm !font-medium !text-[var(--ds-text-secondary)]",
      formFieldInput:
        "!border !border-[var(--ds-border)] !rounded-lg !h-11 !text-sm !bg-[var(--ds-card)] !text-[var(--ds-text)] focus:!border-[var(--ds-accent)] focus:!ring-2 focus:!ring-[var(--ds-accent-glow)]",
      formFieldInputPlaceholder:
        "!text-[var(--ds-text-dim)]",
      formFieldHintText:
        "!text-sm !text-[var(--ds-text-muted)]",
      formFieldAction: "!text-sm !text-[var(--ds-accent)] hover:!opacity-80",
      formButtonPrimary:
        "!bg-[var(--ds-accent)] hover:!opacity-90 !text-white !rounded-lg !h-11 !text-sm !font-semibold !shadow-none",
      footerActionLink:
        "!text-[var(--ds-accent)] hover:!opacity-80 !font-medium !text-sm",
      footerActionText:
        "!text-sm !text-[var(--ds-text-muted)]",
      identityPreviewText:
        "!text-sm !text-[var(--ds-text-secondary)]",
      identityPreviewEditButton:
        "!text-sm !text-[var(--ds-accent)] hover:!opacity-80",
      alertText: "!text-sm",
      otpCodeFieldInput:
        "!border !border-[var(--ds-border)] !rounded-lg !text-center !text-lg !font-mono !bg-[var(--ds-card)] !text-[var(--ds-text)]",
      badge:
        "!text-xs !text-[var(--ds-text-muted)]",
      footer: "!bg-transparent !text-[var(--ds-text-muted)]",
      footerPagesLink:
        "!text-[var(--ds-text-muted)] hover:!text-[var(--ds-text-secondary)]",
    },
  };
}

export function ClerkAuthForm(props: ClerkAuthFormProps) {
  const appearance = useClerkAppearance();

  if (props.mode === "sign-in") {
    return (
      <div className="space-y-5">
        <SignIn
          routing="path"
          path={props.path}
          signUpUrl={props.signUpUrl}
          fallbackRedirectUrl={props.fallbackRedirectUrl}
          appearance={appearance}
        />
        <TrustBadge />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SignUp
        routing="path"
        path={props.path}
        signInUrl={props.signInUrl}
        fallbackRedirectUrl={props.fallbackRedirectUrl}
        appearance={appearance}
      />
      <TrustBadge />
    </div>
  );
}

function TrustBadge() {
  return (
    <div className="flex items-center justify-center gap-2 pt-2 text-xs text-[var(--ds-text-muted)]">
      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
      <span>Secured by Clerk</span>
    </div>
  );
}
