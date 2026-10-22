import { AuthPageLayout } from "@/components/auth-page-layout";
import { ClerkAuthForm } from "@/components/clerk-auth-form";

export default function SignInPage() {
  return (
    <AuthPageLayout>
      <div className="space-y-3">
        <div>
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ds-text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-sienna)]" aria-hidden="true" />
            Your workspace
          </p>
          <h1 className="text-[36px] font-normal leading-[1.08] tracking-[-0.04em] text-[var(--ds-text)]">
            Sign in to Themys
          </h1>
          <p className="mt-[9px] text-[14px] leading-[1.55] text-[var(--ds-text-muted)]">
            Access your scan workspace, saved rules, and billing.
          </p>
        </div>

        <ClerkAuthForm
          mode="sign-in"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </AuthPageLayout>
  );
}
