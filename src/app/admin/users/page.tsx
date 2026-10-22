import Form from "next/form";
import { listAllUsers } from "@/features/admin/server/queries";
import { UsersListClient } from "@/components/admin/users-list-client";
import { FilterSubmitButton } from "@/components/admin/filter-submit-button";
import { Users, UserCheck, Sparkles, Layers } from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = typeof params.search === "string" ? params.search : "";
  const planFilter = typeof params.plan === "string" && ["free", "base", "advanced", "lifetime"].includes(params.plan)
    ? params.plan
    : "all";

  const { users, total } = await listAllUsers(page, 25, search || undefined, planFilter);

  const paidCount = users.filter((u) => u.plan && u.plan !== "free").length;
  const freeCount = users.filter((u) => !u.plan || u.plan === "free").length;

  return (
    <div className="space-y-8 founder-dashboard">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">
            Themys / User Directory
          </p>
          <h1>Registered Accounts</h1>
          <p className="desc">Inspect registered customer profiles, subscription states, and scan quotas.</p>
        </div>
        <span className="admin-record-count">{total.toLocaleString()} matching accounts</span>
      </header>

      {/* KPI Overview Grid */}
      <div className="admin-kpi-grid">
        <article className="admin-kpi admin-kpi-accent">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-neutral">
                <Users />
              </span>
              <h2>Matching Accounts</h2>
            </div>
          </div>
          <p className="admin-kpi-value">{total.toLocaleString()}</p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">Profiles returned by the current D1 filters</p>
          </div>
        </article>

        <article className="admin-kpi">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-success">
                <Sparkles />
              </span>
              <h2>Paid Plans in View</h2>
            </div>
          </div>
          <p className="admin-kpi-value">{paidCount}</p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">Personal, Founder & Lifetime tiers on page</p>
          </div>
        </article>

        <article className="admin-kpi">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-neutral">
                <UserCheck />
              </span>
              <h2>Free Tier in View</h2>
            </div>
          </div>
          <p className="admin-kpi-value">{freeCount}</p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">Default quota accounts on current page</p>
          </div>
        </article>

        <article className="admin-kpi">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-neutral">
                <Layers />
              </span>
              <h2>Current Window</h2>
            </div>
          </div>
          <p className="admin-kpi-value">{users.length}</p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">Page {page} of {Math.max(1, Math.ceil(total / 25))}</p>
          </div>
        </article>
      </div>

      {/* Filters Bar */}
      <section className="admin-panel !p-4">
        <Form action="/admin/users" className="admin-filter-bar">
          <div className="relative min-w-[220px] flex-1">
            <label htmlFor="user-search" className="sr-only">Search accounts by email</label>
            <input
              id="user-search"
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search by user email…"
              className="admin-field w-full"
            />
          </div>
          <label htmlFor="user-plan" className="sr-only">Filter accounts by plan</label>
          <select
            id="user-plan"
            name="plan"
            defaultValue={planFilter}
            className="admin-field"
          >
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="base">Personal</option>
            <option value="advanced">Founder</option>
            <option value="lifetime">Lifetime</option>
          </select>
          <FilterSubmitButton />
        </Form>
      </section>

      <UsersListClient
        users={users}
        page={page}
        total={total}
        searchParams={{ ...(search && { search }), ...(planFilter !== "all" && { plan: planFilter }) }}
      />
    </div>
  );
}
