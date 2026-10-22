"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
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
      colorPrimary: isDark ? "#fafafb" : "#17191c",
      colorBackground: "transparent",
      fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      borderRadius: "13px",
      colorForeground: isDark ? "#fafafb" : "#17191c",
      colorMutedForeground: isDark ? "#a3a6af" : "#777b86",
      colorInputForeground: isDark ? "#fafafb" : "#17191c",
      colorInput: isDark ? "#1c1e22" : "#ffffff",
      colorNeutral: isDark ? "#777b86" : "#979799",
      colorPrimaryForeground: isDark ? "#17191c" : "#ffffff",
      colorBorder: isDark ? "#2e3138" : "#ececec",
      colorRing: isDark ? "#fafafb" : "#17191c",
      colorDanger: isDark ? "#f87171" : "#dc2626",
      colorSuccess: isDark ? "#34d399" : "#059669",
      colorWarning: isDark ? "#fbbf24" : "#d97706",
    },
    options: {
      elevation: "flush" as const,
    },
    elements: {
      rootBox: "w-full",
      cardBox: "shadow-none border-0 bg-transparent",
      card: "shadow-none border-0 bg-transparent p-0",
      header: "mb-0 p-0",
      headerTitle: "hidden",
      headerSubtitle: "hidden",
      socialButtonsBlockButton:
        "border !border-[var(--ds-border)] !rounded-[13px] !h-[46px] font-normal hover:!bg-[var(--ds-card-hover)]",
      socialButtonsBlockButtonText:
        "!text-sm !text-[var(--ds-text-secondary)]",
      socialButtonsBlockButtonArrow:
        "!text-[var(--ds-text-muted)]",
      dividerLine: "!bg-[var(--ds-border)]",
      dividerText: "!text-xs !text-[var(--ds-text-muted)]",
      formFieldLabel:
        "!text-sm !font-medium !text-[var(--ds-text-secondary)]",
      formFieldInput:
        "border! border-[var(--ds-border)]! rounded-[13px]! h-[48px]! text-[16px]! bg-[var(--ds-card)]! text-[var(--ds-text)]! focus:border-[var(--ds-accent)]! focus:ring-2! focus:ring-[var(--ds-accent-glow)]!",
      formFieldInputPlaceholder:
        "!text-[var(--ds-text-dim)]",
      formFieldHintText:
        "!text-sm !text-[var(--ds-text-muted)]",
      formFieldAction: "!text-sm !text-[var(--ds-accent)] hover:!opacity-80",
      formButtonPrimary:
        "!bg-[var(--ds-accent)] hover:!opacity-90 !text-[var(--primary-foreground)] !rounded-full !h-12 !text-[16px] !font-normal !shadow-none",
      identityPreviewText:
        "!text-sm !text-[var(--ds-text-secondary)]",
      identityPreviewEditButton:
        "!text-sm !text-[var(--ds-accent)] hover:!opacity-80",
      alertText: "!text-sm",
      otpCodeFieldInput:
        "!border !border-[var(--ds-border)] !rounded-lg !text-center !text-lg !font-mono !bg-[var(--ds-card)] !text-[var(--ds-text)]",
      badge:
        "!text-xs !text-[var(--ds-text-muted)]",
      footer: "hidden!",
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
        <p className="text-center text-xs text-[var(--ds-text-muted)]">
          New to Themys?{" "}
          <Link
            href={props.signUpUrl}
            className="font-medium text-[var(--ds-accent)] hover:underline hover:underline-offset-2"
          >
            Create an account
          </Link>
        </p>
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
      <p className="text-center text-xs text-[var(--ds-text-muted)]">
        Already have an account?{" "}
        <Link
          href={props.signInUrl}
          className="font-medium text-[var(--ds-accent)] hover:underline hover:underline-offset-2"
        >
          Sign in
        </Link>
      </p>
      <TrustBadge />
    </div>
  );
}

function TrustBadge() {
  return (
    <div className="space-y-[5px] border-t border-[var(--ds-border)] pt-4 text-center text-[11px] leading-[1.65] text-[var(--ds-text-muted)]">
      <div className="mb-1 flex items-center justify-center gap-[7px] font-bold">
        <ShieldCheck className="h-3.5 w-3.5 text-[var(--ds-success)]" strokeWidth={2} />
        <span>Secured by Clerk</span>
      </div>
      <p>
        By continuing, you agree to Themys&apos; <a className="text-[var(--ds-accent)] underline underline-offset-2" href="https://docs.themys.ca/legal#terms">Terms</a> and acknowledge the <a className="text-[var(--ds-accent)] underline underline-offset-2" href="https://docs.themys.ca/legal#privacy">Privacy Policy</a>.
      </p>
    </div>
  );
}
