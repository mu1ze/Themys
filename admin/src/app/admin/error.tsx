"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-page] render failed", error);
  }, [error]);

  return (
    <section className="admin-error" role="alert">
      <p className="admin-eyebrow">DATA UNAVAILABLE</p>
      <h1>This admin view could not be loaded.</h1>
      <p>
        The page has not replaced the failed read with zeroes. Retry the guarded
        backend request; if it fails again, inspect the Worker and D1 bindings.
      </p>
      <button type="button" onClick={reset}>Retry view</button>
      {error.digest && <code>Reference {error.digest}</code>}
    </section>
  );
}
