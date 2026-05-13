import { useQuery } from "@tanstack/react-query";
import { Clock, Trophy, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { HourSummaryDTO, VolunteerHourLogDTO } from "@lths/shared";
import { formatMinutes } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCardSkeleton } from "@/components/shared/LoadingSkeletons";

const BADGES = [
  { id: "first_session", label: "First Session", icon: "🎯", minutesRequired: 1, description: "Complete your first tutoring session" },
  { id: "ten_hours", label: "10 Hours", icon: "⭐", minutesRequired: 600, description: "10 hours of tutoring" },
  { id: "twenty_five_hours", label: "25 Hours", icon: "🌟", minutesRequired: 1500, description: "25 hours of tutoring" },
  { id: "fifty_hours", label: "50 Hours", icon: "🏆", minutesRequired: 3000, description: "50 hours of tutoring" },
  { id: "hundred_hours", label: "100 Hours", icon: "💎", minutesRequired: 6000, description: "100 hours of tutoring" },
];

const MEDAL: Record<number, { icon: string; color: string }> = {
  0: { icon: "🥇", color: "text-yellow-500" },
  1: { icon: "🥈", color: "text-slate-400" },
  2: { icon: "🥉", color: "text-amber-600" },
};

interface LeaderboardEntry {
  id: string;
  totalMinutes: number;
  period: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    grade: number;
    avatarUrl?: string | null;
  };
}

export function HoursPage() {
  const { data: hours, isLoading } = useQuery({
    queryKey: ["hours"],
    queryFn: () => api.get<HourSummaryDTO>("/hours"),
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.get<LeaderboardEntry[]>("/hours/leaderboard"),
  });

  const summary = hours?.data;
  const board = leaderboard?.data ?? [];
  const totalMinutes = summary?.totalMinutes ?? 0;

  // Next badge not yet earned
  const nextBadge = BADGES.find((b) => totalMinutes < b.minutesRequired);
  const progressPct = nextBadge
    ? Math.min(100, Math.round((totalMinutes / nextBadge.minutesRequired) * 100))
    : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Volunteer Hours</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every hour you tutor helps a classmate succeed and builds your transcript.
        </p>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">All Time</p>
            </div>
            <p className="text-3xl font-extrabold text-foreground">
              {summary ? formatMinutes(summary.totalMinutes) : "0h"}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground font-medium truncate">
                {summary?.currentPeriod ?? "This Semester"}
              </p>
            </div>
            <p className="text-3xl font-extrabold text-primary">
              {summary?.logs?.find((l) => l.period === summary.currentPeriod)
                ? formatMinutes(summary.logs.find((l) => l.period === summary.currentPeriod)!.totalMinutes)
                : "0h"}
            </p>
          </div>
        </div>
      )}

      {/* Next milestone progress */}
      {!isLoading && nextBadge && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{nextBadge.icon}</span>
              <div>
                <p className="text-sm font-semibold">Next: {nextBadge.label}</p>
                <p className="text-xs text-muted-foreground">{nextBadge.description}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-primary">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {formatMinutes(totalMinutes)} / {formatMinutes(nextBadge.minutesRequired)}
            {" "}— {formatMinutes(nextBadge.minutesRequired - totalMinutes)} to go
          </p>
        </div>
      )}

      {/* Period breakdown */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Hour Log</h2>
        {!summary || summary.logs.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No hours logged yet"
            description="Complete tutoring sessions and confirm them to start earning volunteer hours automatically."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {summary.logs.map((log: VolunteerHourLogDTO, i) => (
              <div
                key={log.id}
                className={`flex items-center justify-between px-5 py-4 ${i < summary.logs.length - 1 ? "border-b" : ""}`}
              >
                <div>
                  <p className="font-medium text-sm">{log.period}</p>
                  {log.exportedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Exported {new Date(log.exportedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <p className="text-lg font-bold text-foreground">{formatMinutes(log.totalMinutes)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Badges */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Badges</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {BADGES.map((badge) => {
            const earned = totalMinutes >= badge.minutesRequired;
            const pct = Math.min(100, Math.round((totalMinutes / badge.minutesRequired) * 100));
            return (
              <div
                key={badge.id}
                title={badge.description}
                className={`flex flex-col items-center rounded-xl border p-3 text-center transition-all ${
                  earned
                    ? "border-primary/30 bg-primary/5 shadow-sm"
                    : "border-border bg-card"
                }`}
              >
                <span className={`text-3xl ${!earned ? "grayscale opacity-40" : ""}`}>{badge.icon}</span>
                <p className={`mt-1.5 text-xs font-semibold leading-tight ${earned ? "text-primary" : "text-muted-foreground"}`}>
                  {badge.label}
                </p>
                {earned ? (
                  <span className="mt-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Earned
                  </span>
                ) : (
                  <div className="mt-1.5 w-full">
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-1 rounded-full bg-primary/40" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{pct}%</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-semibold">Semester Leaderboard</h2>
        </div>
        {board.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet — be the first!</p>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {board.map((entry, i) => {
              const medal = MEDAL[i];
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 px-5 py-3.5 ${i < board.length - 1 ? "border-b" : ""} ${i === 0 ? "bg-yellow-50/50 dark:bg-yellow-950/10" : ""}`}
                >
                  <span className={`w-7 text-center text-base ${medal ? "" : "text-sm text-muted-foreground font-bold"}`}>
                    {medal ? medal.icon : i + 1}
                  </span>
                  {entry.user?.avatarUrl ? (
                    <img src={entry.user.avatarUrl} className="h-9 w-9 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                      {entry.user?.firstName?.[0] ?? "?"}{entry.user?.lastName?.[0] ?? ""}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{entry.user?.firstName} {entry.user?.lastName}</p>
                    <p className="text-xs text-muted-foreground">Grade {entry.user?.grade}</p>
                  </div>
                  <p className={`text-sm font-bold shrink-0 ${i === 0 ? "text-yellow-600 dark:text-yellow-400" : "text-foreground"}`}>
                    {formatMinutes(entry.totalMinutes)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
