import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // The outer Worker initializes @sentry/cloudflare for every runtime. Capture
  // handled Next.js errors in that request scope without importing the Node
  // SDK or its build-time instrumentation into workerd.
  const Sentry = await import("@sentry/cloudflare");
  Sentry.captureException(error, {
    contexts: {
      next: {
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource,
        revalidateReason: context.revalidateReason ?? "none",
      },
    },
    tags: {
      "next.request_method": request.method,
      "next.route_type": context.routeType,
    },
  });
};
