import { useQuery } from "@tanstack/react-query";
import { Clock, Trophy } from "lucide-react";
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
            <p className="text-sm text-muted-foreground">Total Hours (All Time)</p>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {summary ? formatMinutes(summary.totalMinutes) : "0h"}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{summary?.currentPeriod ?? "Current Period"}</p>
            <p className="mt-2 text-3xl font-bold text-primary">
              {summary?.logs?.find((l) => l.period === summary.currentPeriod)
                ? formatMinutes(summary.logs.find((l) => l.period === summary.currentPeriod)!.totalMinutes)
                : "0h"}
            </p>
          </div>
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
          <div className="space-y-2">
            {summary.logs.map((log: VolunteerHourLogDTO) => (
              <div key={log.id} className="flex items-center justify-between rounded-xl border bg-card px-5 py-4">
                <div>
                  <p className="font-medium text-sm">{log.period}</p>
                  {log.exportedAt && (
                    <p className="text-xs text-muted-foreground">Exported</p>
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
            const earned = (summary?.totalMinutes ?? 0) >= badge.minutesRequired;
            return (
              <div
                key={badge.id}
                title={badge.description}
                className={`flex flex-col items-center rounded-xl border p-3 text-center transition-all ${
                  earned ? "border-primary/30 bg-primary/5" : "bg-card opacity-40 grayscale"
                }`}
              >
                <span className="text-3xl">{badge.icon}</span>
                <p className={`mt-1.5 text-xs font-semibold ${earned ? "text-primary" : "text-muted-foreground"}`}>
                  {badge.label}
                </p>
                {earned && (
                  <span className="mt-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Earned
                  </span>
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
            {board.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center gap-4 border-b px-5 py-3 last:border-b-0"
              >
                <span
                  className={`w-6 text-center text-sm font-bold ${
                    i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                {entry.user.avatarUrl ? (
                  <img src={entry.user.avatarUrl} className="h-8 w-8 rounded-full" alt="" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {entry.user.firstName[0]}{entry.user.lastName[0]}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{entry.user.firstName} {entry.user.lastName}</p>
                  <p className="text-xs text-muted-foreground">Grade {entry.user.grade}</p>
                </div>
                <p className="text-sm font-bold">{formatMinutes(entry.totalMinutes)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
