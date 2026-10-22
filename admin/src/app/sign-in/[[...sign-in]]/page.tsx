import { AuthPageLayout } from "@/components/auth-page-layout";
import { ClerkAuthForm } from "../../../components/admin-clerk-auth-form";
import { AdminSignInError } from "../../../components/admin-sign-in-error";

export default function AdminSignInPage() {
  return (
    <AuthPageLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--ds-text)]">
            Admin sign in
          </h2>
          <p className="mt-2 text-sm text-[var(--ds-text-muted)]">
            Access the Themys admin panel to manage users, scans, and billing.
          </p>
        </div>

        <AdminSignInError />

        <ClerkAuthForm
          mode="sign-in"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/admin"
        />
      </div>
    </AuthPageLayout>
  );
}
