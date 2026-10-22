"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/interior/drawer";
import type { AdminNavigationSummary } from "@/features/admin/server/queries";

type NavItem = {
  href: string;
  label: string;
  count?: "unclassified";
};

type NavGroup = {
  title: string;
  /** Secondary groups are the demoted Analytics group — tabs in the page
   *  header are the primary surface for those destinations (01·C + 02·D). */
  secondary?: boolean;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Operations",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/scans", label: "Scans", count: "unclassified" },
      { href: "/admin/cache", label: "Cache & limits" },
      { href: "/admin/billing", label: "Billing cases" },
    ],
  },
  {
    title: "Analytics · see tabs",
    secondary: true,
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/conversion", label: "Growth" },
      { href: "/admin/revenue", label: "Revenue" },
      { href: "/admin/system", label: "Reliability" },
      { href: "/admin/usage", label: "Usage" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

interface AdminSidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  navigation: AdminNavigationSummary;
}

function NavigationLinks({
  pathname,
  navigation,
  onNavigate,
  id,
}: {
  pathname: string;
  navigation: AdminNavigationSummary;
  onNavigate?: () => void;
  id?: string;
}) {
  return (
    <nav id={id} className="admin-nav" aria-label="Admin navigation">
      {navGroups.map((group) => (
        <div key={group.title}>
          <div className="admin-rail-group">{group.title}</div>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const count = item.count === "unclassified" ? navigation.unclassifiedScans : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "admin-rail-item",
                  group.secondary && "secondary",
                  active && !group.secondary && "font-medium",
                )}
              >
                <span>{item.label}</span>
                {count != null && count > 0 && (
                  <span className="count" aria-label={`${count} unclassified documents`}>
                    {count.toLocaleString()}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function DataFoot({ navigation }: { navigation: AdminNavigationSummary }) {
  return (
    <div className="admin-rail-foot">
      <span className="admin-rail-status" data-state={navigation.dataState}>
        <i aria-hidden="true" />
        {navigation.dataState === "connected" ? "D1 connected" : "D1 unavailable"}
      </span>
      <span>THEMYS · V3</span>
    </div>
  );
}

export function AdminSidebar({ mobileOpen, setMobileOpen, navigation }: AdminSidebarProps) {
  const pathname = usePathname() ?? "/admin";

  return (
    <>
      <aside
        className="admin-rail admin-rail-desktop"
        aria-label="Admin navigation"
      >
        <div className="admin-rail-brand">
          <Link href="/admin" className="block">
            <div className="word">Themys — Admin</div>
            <div className="sub">internal · v3</div>
          </Link>
        </div>
        <NavigationLinks pathname={pathname} navigation={navigation} />
        <DataFoot navigation={navigation} />
      </aside>

      <Drawer
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Themys — Admin"
        description="Founder operations workspace"
        side="left"
        width={288}
        className="admin-mobile-drawer"
        footer={<DataFoot navigation={navigation} />}
      >
        <NavigationLinks
          pathname={pathname}
          navigation={navigation}
          onNavigate={() => setMobileOpen(false)}
          id="admin-mobile-navigation"
        />
      </Drawer>
    </>
  );
}
