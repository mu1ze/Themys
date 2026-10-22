const PROTECTED_ROUTE_ROOTS = [
  "/dashboard",
  "/scan",
  "/history",
  "/settings",
  "/monitoring",
] as const;

function isRouteTree(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function isProtectedAppPath(pathname: string): boolean {
  return PROTECTED_ROUTE_ROOTS.some((root) => isRouteTree(pathname, root));
}

export function isAdminPath(pathname: string): boolean {
  return isRouteTree(pathname, "/admin");
}
