import { AuthPageLayout } from "@/components/auth-page-layout";
import { ClerkAuthForm } from "@/components/clerk-auth-form";

export default function SignUpPage() {
  return (
    <AuthPageLayout>
      <div className="space-y-3">
        <div>
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ds-text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-sienna)]" aria-hidden="true" />
            Start your workspace
          </p>
          <h1 className="text-[36px] font-normal leading-[1.08] tracking-[-0.04em] text-[var(--ds-text)]">
            Create your account
          </h1>
          <p className="mt-[9px] text-[14px] leading-[1.55] text-[var(--ds-text-muted)]">
            Keep scans, saved rules, and billing in one place.
          </p>
        </div>

        <ClerkAuthForm
          mode="sign-up"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </AuthPageLayout>
  );
}
