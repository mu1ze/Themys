import { clerkMiddleware } from "@clerk/nextjs/server";

import { isAdminPath, isProtectedAppPath } from "@/lib/proxy-routing";

// OpenNext Cloudflare does not yet support Next 16's Node-based proxy runtime.
// Keep the Edge middleware convention until the adapter adds that support.
export default clerkMiddleware(
  async (auth, req) => {
    const { pathname, search } = req.nextUrl;

    if (isProtectedAppPath(pathname)) {
      await auth.protect();
    }

    if (isAdminPath(pathname)) {
      return Response.redirect(
        new URL(`${pathname}${search}`, "https://admin.themys.ca"),
        308,
      );
    }
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
