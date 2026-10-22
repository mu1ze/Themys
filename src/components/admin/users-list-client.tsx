"use client";

import { AdminTable, Pagination } from "@/components/admin/admin-table";
import { PlanBadge, SubscriptionStatusBadge } from "@/components/admin/plan-badge";
import type { AdminUserRow } from "@/features/admin/server/queries";

type UsersListClientProps = {
  users: AdminUserRow[];
  total: number;
  page: number;
  searchParams: Record<string, string>;
};

export function UsersListClient({ users, total, page, searchParams }: UsersListClientProps) {
  const columns = [
    {
      key: "email",
      header: "Email",
      render: (row: AdminUserRow) => (
        <span className="font-medium text-[var(--admin-ink)]">{row.email}</span>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (row: AdminUserRow) => <PlanBadge plan={row.plan} />,
    },
    {
      key: "status",
      header: "Subscription",
      render: (row: AdminUserRow) => (
        <SubscriptionStatusBadge status={row.subscriptionStatus} />
      ),
    },
    {
      key: "scans",
      header: "Scans",
      render: (row: AdminUserRow) => <span className="font-mono text-[var(--admin-muted)]">{row.scanCount}</span>,
    },
    {
      key: "credits",
      header: "Credits",
      render: (row: AdminUserRow) => <span className="font-mono text-[var(--admin-muted)]">{row.creditBalance}</span>,
    },
    {
      key: "joined",
      header: "Joined",
      render: (row: AdminUserRow) => (
        <span className="font-mono text-xs text-[var(--admin-dim)]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <>
      <AdminTable
        columns={columns}
        rows={users}
        getRowKey={(row) => row.id}
        rowHref={(row) => `/admin/users/${row.id}`}
        emptyMessage="No users found matching your filters."
      />
      <Pagination
        page={page}
        pageSize={25}
        total={total}
        basePath="/admin/users"
        searchParams={searchParams}
      />
    </>
  );
}
