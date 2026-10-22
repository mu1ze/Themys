import { clerkMiddleware } from "@clerk/nextjs/server";

// OpenNext Cloudflare requires the Edge middleware convention; Next.js 16's
// proxy convention selects the unsupported Node.js middleware runtime.
export default clerkMiddleware({
  signInUrl: "/sign-in",
  signUpUrl: "/sign-in",
});

export const config = {
  matcher: [
    "/((?!_next|sign-in|sign-up|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
