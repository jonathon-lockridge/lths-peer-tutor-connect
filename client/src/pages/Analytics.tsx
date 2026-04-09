import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { BarChart2, Users, Clock, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { StatCardSkeleton } from "@/components/shared/LoadingSkeletons";

interface AdminStats {
  totalUsers: number;
  totalTutors: number;
  totalRequests: number;
  openRequests: number;
  totalSessions: number;
  confirmedSessions: number;
  totalHours: number;
  topSubjects: { subjectId: string; subjectName: string; count: number }[];
}

const COLORS = ["#CC0000", "#1A1A1A", "#ef4444", "#6b7280", "#f97316"];

export function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
    retry: false,
  });

  const stats = data?.data;

  const sessionData = stats
    ? [
        { name: "Total Sessions", value: stats.totalSessions },
        { name: "Confirmed", value: stats.confirmedSessions },
        { name: "Open Requests", value: stats.openRequests },
      ]
    : [];

  const userBreakdown = stats
    ? [
        { name: "Tutors", value: stats.totalTutors },
        { name: "Students Only", value: stats.totalUsers - stats.totalTutors },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-brand-black">Analytics</h1>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Students", value: stats?.totalUsers, icon: Users },
            { label: "Active Tutors", value: stats?.totalTutors, icon: Users },
            { label: "Hours Logged", value: stats?.totalHours != null ? `${stats.totalHours}h` : undefined, icon: Clock },
            { label: "Total Requests", value: stats?.totalRequests, icon: BookOpen },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border bg-white p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Icon className="h-3.5 w-3.5" /> {label}
              </div>
              <p className="text-2xl font-bold text-brand-black">{value ?? "—"}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top requested subjects bar chart */}
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 font-semibold text-sm">Most Requested Subjects</h2>
          {stats?.topSubjects && stats.topSubjects.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.topSubjects} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="subjectName"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number) => [`${value} requests`, "Requests"]}
                  labelStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#CC0000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>

        {/* User breakdown pie chart */}
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 font-semibold text-sm">Community Breakdown</h2>
          {stats && stats.totalUsers > 0 ? (
            <div className="flex items-center justify-center gap-6">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie
                    data={userBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {userBreakdown.map((_entry, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, "Users"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {userBreakdown.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <div>
                      <p className="text-xs font-medium">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">{entry.value} users</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Sessions overview bar chart */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 font-semibold text-sm">Session Overview</h2>
        {sessionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sessionData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#1A1A1A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No session data yet
          </div>
        )}
      </div>

      {!data && !isLoading && (
        <div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-800">
          Analytics shows full data for Admin accounts. You're seeing your personal view.
        </div>
      )}
    </div>
  );
}
