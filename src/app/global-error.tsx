"use client";

import * as Sentry from "@sentry/browser";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-950">
        <main className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Themys</p>
          <h1 className="mt-3 text-3xl font-bold">Something did not load</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your data is safe. Please retry; if this continues, return to the dashboard and try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
