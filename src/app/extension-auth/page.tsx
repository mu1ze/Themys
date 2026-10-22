"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { useAuth, useUser, SignIn } from "@clerk/nextjs";

type ExternalAuthResponse = { ok?: boolean; error?: string };

type CallbackRuntime = {
  lastError?: { message?: string };
  sendMessage(
    extensionId: string,
    message: Record<string, unknown>,
    callback: (response: ExternalAuthResponse | undefined) => void,
  ): void;
};

type PromiseRuntime = {
  sendMessage(
    extensionId: string,
    message: Record<string, unknown>,
  ): Promise<ExternalAuthResponse | undefined>;
};

// Preserve the current query (return URL or background refresh) across hydration.
const useAuthSearch = () =>
  useSyncExternalStore(
    () => () => {},
    () =>
      typeof window !== "undefined" ? window.location.search : "",
    () => "",
  );

const useReturnUrl = () =>
  useSyncExternalStore(
    () => () => {},
    () =>
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("return")
        : null,
    () => null
  );

async function sendToExtension(
  extensionId: string,
  message: Record<string, unknown>,
): Promise<ExternalAuthResponse> {
  if (!/^[a-z0-9._-]{8,128}$/i.test(extensionId)) {
    throw new Error("Invalid extension identifier");
  }

  const runtimes = globalThis as typeof globalThis & {
    browser?: { runtime?: PromiseRuntime };
    chrome?: { runtime?: CallbackRuntime };
  };

  if (runtimes.browser?.runtime) {
    const response = await runtimes.browser.runtime.sendMessage(extensionId, message);
    return response ?? { ok: false, error: "The extension did not respond" };
  }

  const runtime = runtimes.chrome?.runtime;
  if (!runtime) throw new Error("The Themys extension is not available");

  return new Promise((resolve, reject) => {
    runtime.sendMessage(extensionId, message, (response) => {
      const error = runtime.lastError?.message;
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve(response ?? { ok: false, error: "The extension did not respond" });
    });
  });
}

function isHttpReturnUrl(value: string | null): boolean {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export default function ExtensionAuthPage() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [sent, setSent] = useState(false);
  const [signInRequested, setSignInRequested] = useState(false);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const returnUrl = useReturnUrl();
  const authSearch = useAuthSearch();
  const searchParams = new URLSearchParams(authSearch);
  const isRefresh = searchParams.has("extension_refresh");
  const extensionId = searchParams.get("extension_id");
  const hasHttpReturn = isHttpReturnUrl(returnUrl);
  const forceRedirectUrl = `/extension-auth${authSearch}`;

  // Send credentials through the browser's allowlisted external-extension
  // channel. Never broadcast a session token into the page with postMessage.
  useEffect(() => {
    if (!isSignedIn || !user || sent || !extensionId) return;

    const clerkId = user.id;
    const targetExtensionId = extensionId;
    let cancelled = false;

    async function sendToken() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const response = await sendToExtension(targetExtensionId, {
          type: "SET_AUTH_TOKEN",
          token,
          clerkId,
          mode: isRefresh ? "refresh" : "connect",
        });
        if (cancelled) return;
        if (!response.ok) throw new Error(response.error || "The extension rejected the session");
        setSent(true);
      } catch (error) {
        if (!cancelled) {
          setConnectionError(error instanceof Error ? error.message : "Failed to connect the extension");
        }
      }
    }

    sendToken();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user, getToken, sent, isRefresh, extensionId]);

  // During a background refresh, if the Clerk web session has expired, tell the
  // extension so it can open a visible sign-in tab instead of silently failing.
  useEffect(() => {
    if (!isRefresh || isSignedIn || signInRequested || !extensionId) return;

    let cancelled = false;
    void sendToExtension(extensionId, { type: "AUTH_NEEDS_SIGNIN" })
      .then((response) => {
        if (!cancelled && response.ok) setSignInRequested(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setConnectionError(error instanceof Error ? error.message : "Failed to reconnect the extension");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isRefresh, isSignedIn, signInRequested, extensionId]);

  useEffect(() => {
    if (!sent || !hasHttpReturn) return;

    window.close();
    const timer = window.setTimeout(() => setCloseBlocked(true), 150);
    return () => window.clearTimeout(timer);
  }, [sent, hasHttpReturn]);

  if (sent) {
    const successMessage = hasHttpReturn && closeBlocked
      ? "You can close this tab and go back to the page you were scanning."
      : hasHttpReturn
        ? "Returning you to the page you were scanning..."
        : "You can close this tab and return to the extension.";

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ds-bg)]">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <svg
              className="h-8 w-8 text-emerald-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--ds-text)]">
            Signed in successfully!
          </h1>
          <p className="text-[var(--ds-text-secondary)]">
            {successMessage}
          </p>
          {(!hasHttpReturn || closeBlocked) && (
            <button
              onClick={() => window.close()}
              className="mt-4 inline-flex h-11 items-center rounded-full bg-[#17191c] dark:bg-[#fafafb] px-6 text-sm font-medium text-white dark:text-[#17191c] transition hover:opacity-90"
            >
              Close this tab
            </button>
          )}
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ds-bg)]">
        <div className="w-full max-w-md space-y-6 p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ds-accent)]/10">
              <svg
                className="h-6 w-6 text-[var(--ds-accent)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h1 className="text-2xl font-medium tracking-tight text-[var(--ds-text)]">
              Sign in to Themys
            </h1>
            <p className="mt-2 text-sm text-[var(--ds-text-secondary)]">
              Sign in to connect the Themys browser extension
            </p>
          </div>
          <div className="border-y border-[var(--ds-border)] py-6">
            <SignIn
              routing="hash"
              forceRedirectUrl={forceRedirectUrl}
              signUpForceRedirectUrl={forceRedirectUrl}
            />
          </div>
        </div>
      </main>
    );
  }

  if (!extensionId || connectionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ds-bg)] px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-medium tracking-tight text-[var(--ds-text)]">
            Could not connect the extension
          </h1>
          <p className="text-[var(--ds-text-secondary)]">
            {connectionError ?? "Open this sign-in page from the Themys extension and try again."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ds-bg)]">
      <div className="text-center space-y-4">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--ds-accent)] border-t-transparent" />
        <p className="text-[var(--ds-text-secondary)]">
          {isRefresh ? "Refreshing extension session..." : "Connecting extension..."}
        </p>
      </div>
    </main>
  );
}
