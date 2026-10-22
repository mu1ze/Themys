import assert from "node:assert/strict";
import test from "node:test";

import { isAdminPath, isProtectedAppPath } from "./proxy-routing.ts";

test("protected app paths include route roots and descendants", () => {
  for (const pathname of [
    "/dashboard",
    "/dashboard/developer",
    "/scan/new",
    "/history",
    "/settings/profile",
    "/monitoring/alerts",
  ]) {
    assert.equal(isProtectedAppPath(pathname), true, pathname);
  }
});

test("protected app paths reject public and lookalike routes", () => {
  for (const pathname of [
    "/",
    "/pricing",
    "/sign-in",
    "/extension-auth",
    "/dashboard-preview",
    "/scanner",
  ]) {
    assert.equal(isProtectedAppPath(pathname), false, pathname);
  }
});

test("admin routing includes only the admin route tree", () => {
  assert.equal(isAdminPath("/admin"), true);
  assert.equal(isAdminPath("/admin/users"), true);
  assert.equal(isAdminPath("/administrator"), false);
});
