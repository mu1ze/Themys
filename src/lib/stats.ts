import { unstable_cache } from "next/cache";
import { getDatabase } from "./database";

export type LiveStats = { users: number; scans: number; clauses: number };

const loadLiveStats = async (): Promise<LiveStats> => {
  const database = getDatabase();
  const [users, scans, clauses] = await Promise.all([
    database.from("users").select("id", { count: "exact", head: true }),
    database.from("scans").select("id", { count: "exact", head: true }),
    database.from("clauses").select("id", { count: "exact", head: true }),
  ]);

  return {
    users: users.count ?? 0,
    scans: scans.count ?? 0,
    clauses: clauses.count ?? 0,
  };
};

const getCachedLiveStats = unstable_cache(loadLiveStats, ["public-live-stats"], {
  revalidate: 300,
  tags: ["public-live-stats"],
});

export async function getLiveStats(): Promise<LiveStats> {
  return getCachedLiveStats();
}
