import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users, Clock, BookOpen, TrendingUp, Download, CheckCircle2, XCircle, ChevronDown, ChevronUp, MessageSquare, Trash2, UserMinus } from "lucide-react";
import { useState } from "react";
import { api, getAuthToken } from "@/lib/api";
import { TutorVerificationDTO, UserDTO } from "@lths/shared";
import { StatCardSkeleton } from "@/components/shared/LoadingSkeletons";
import { useToast } from "@/components/shared/Toast";

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  grade?: number | null;
}

interface FeedbackEntry {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

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

/** Generate the last N semester period strings, most-recent first */
function getPastPeriods(count = 6): string[] {
  const periods: string[] = [];
  const now = new Date();
  let year = now.getFullYear();
  let isFall = now.getMonth() >= 6; // Jun-Dec = Fall
  for (let i = 0; i < count; i++) {
    if (isFall) {
      periods.push(`${year}-${year + 1} Fall`);
      isFall = false;
    } else {
      periods.push(`${year - 1}-${year} Spring`);
      year--;
      isFall = true;
    }
  }
  return periods;
}

export function AdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [exportPeriod, setExportPeriod] = useState<string>("__all__");
  // Must be declared before any early returns to satisfy Rules of Hooks
  const [isExporting, setIsExporting] = useState(false);
  const pastPeriods = getPastPeriods(6);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
    retry: false,
  });

  const { data: pendingData } = useQuery({
    queryKey: ["verifications-pending"],
    queryFn: () => api.get<TutorVerificationDTO[]>("/verification/pending"),
    enabled: !error,
  });

  const { data: feedbackData } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: () => api.get<FeedbackEntry[]>("/feedback"),
    enabled: !error,
  });

  const { data: adminUsersData } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<{ users: AdminUser[] }>("/admin/users?limit=200"),
    enabled: !error,
    select: (res) => (res.data?.users ?? []).filter((u) => u.role === "ADMIN"),
  });

  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<UserDTO>("/auth/me"),
    enabled: !error,
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldCheck className="mb-3 h-12 w-12 text-gray-300" />
        <h2 className="text-lg font-semibold">Admin Access Required</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This page is only available to teacher/counselor accounts.
        </p>
      </div>
    );
  }

  const stats = data?.data;
  const pending = pendingData?.data ?? [];
  const feedbackList = feedbackData?.data ?? [];
  const adminUsers = adminUsersData ?? [];
  const currentUserId = meData?.data?.id;

  const handleExport = async () => {
    const period = exportPeriod === "__all__" ? undefined : exportPeriod;
    setIsExporting(true);
    try {
      const token = await getAuthToken();
      const url = `${import.meta.env.VITE_API_URL ?? ""}/api/hours/export${period ? `?period=${encodeURIComponent(period)}` : ""}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error((json as any).error ?? "Export failed");
        return;
      }
      // Use server's Content-Disposition filename when available
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `LTHS-PeerTutorConnect-VolunteerHours${period ? `-${period.replace(/\s+/g, "-")}` : ""}.csv`;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("Export downloaded!");
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
      </div>

      {/* Pending Tutor Verifications — prominent if any exist */}
      {pending.length > 0 && (
        <div className="rounded-xl border-2 border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-yellow-700 dark:text-yellow-300" />
            <h2 className="font-semibold text-yellow-900 dark:text-yellow-100">
              Pending Tutor Applications ({pending.length})
            </h2>
          </div>
          <div className="space-y-3">
            {pending.map((v) => (
              <VerificationReviewCard
                key={v.id}
                verification={v}
                onApproved={() => {
                  qc.invalidateQueries({ queryKey: ["verifications-pending"] });
                  qc.invalidateQueries({ queryKey: ["admin-stats"] });
                  toast.success("Application approved!");
                }}
                onRejected={() => {
                  qc.invalidateQueries({ queryKey: ["verifications-pending"] });
                  toast.success("Application rejected.");
                }}
                onError={(msg) => toast.error(msg)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stats grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            { label: "Total Students", value: stats?.totalUsers, icon: Users },
            { label: "Active Tutors", value: stats?.totalTutors, icon: Users },
            { label: "Total Requests", value: stats?.totalRequests, icon: BookOpen },
            { label: "Open Requests", value: stats?.openRequests, icon: BookOpen },
            { label: "Confirmed Sessions", value: stats?.confirmedSessions, icon: Clock },
            { label: "Total Hours Logged", value: stats?.totalHours != null ? `${stats.totalHours}h` : "—", icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4" />
                {label}
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{value ?? "—"}</p>
            </div>
          ))}
        </div>
      )}

      {/* Top subjects */}
      {stats?.topSubjects && stats.topSubjects.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Most Requested Subjects</h2>
          <div className="space-y-2">
            {stats.topSubjects.map((s, i) => (
              <div key={s.subjectId} className="flex items-center gap-3">
                <span className="w-5 text-sm text-muted-foreground">{i + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{s.subjectName}</span>
                    <span className="text-sm text-muted-foreground">{s.count} requests</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${(s.count / stats.topSubjects[0].count) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-1 font-semibold">Export Volunteer Hours</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Download a formatted CSV report for NHS, club hours, or school records. Marks records as exported.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Semester</label>
            <select
              value={exportPeriod}
              onChange={(e) => setExportPeriod(e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="__all__">All Time</option>
              {pastPeriods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Exporting…" : "Download CSV"}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The report includes tutor summary, session detail, and totals — formatted for school submission.
        </p>
      </div>
      {/* Admin Users — demote management */}
      {adminUsers.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Admin Users ({adminUsers.length})</h2>
          </div>
          <div className="space-y-2">
            {adminUsers.map((u) => (
              <AdminUserRow
                key={u.id}
                user={u}
                isSelf={u.id === currentUserId}
                onDemoted={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
              />
            ))}
          </div>
        </div>
      )}

      {/* App Feedback */}
      {feedbackList.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">App Feedback ({feedbackList.length})</h2>
          </div>
          <div className="space-y-3">
            {feedbackList.map((f) => (
              <FeedbackCard
                key={f.id}
                feedback={f}
                onDeleted={() => qc.invalidateQueries({ queryKey: ["admin-feedback"] })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin User Row (demote) ──────────────────────────────────────────────────

function AdminUserRow({ user, isSelf, onDemoted }: { user: AdminUser; isSelf: boolean; onDemoted: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  const demoteMutation = useMutation({
    mutationFn: () => api.post(`/admin/users/${user.id}/demote`, {}),
    onSuccess: () => { toast.success(`${user.firstName} ${user.lastName} demoted to Student.`); onDemoted(); setConfirming(false); },
    onError: (e: Error) => toast.error(e.message || "Failed to demote"),
  });

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium">
          {user.firstName} {user.lastName}
          {isSelf && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">You</span>}
        </p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      {isSelf ? (
        <span className="text-xs text-muted-foreground italic">Cannot demote self</span>
      ) : !confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <UserMinus className="h-3.5 w-3.5" />
          Demote
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Are you sure?</span>
          <button
            onClick={() => demoteMutation.mutate()}
            disabled={demoteMutation.isPending}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-red-700"
          >
            {demoteMutation.isPending ? "…" : "Yes"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// Used in verification approval card to show confidence label tooltips
const CONFIDENCE_LABELS = ["", "Beginner", "Developing", "Comfortable", "Strong", "Expert"];

// ── Feedback card with delete ─────────────────────────────────────────────────

function FeedbackCard({ feedback, onDeleted }: { feedback: FeedbackEntry; onDeleted: () => void }) {
  const toast = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/feedback/${feedback.id}`),
    onSuccess: () => { toast.success("Feedback removed."); onDeleted(); },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  return (
    <div className="rounded-lg border bg-muted p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <p className="text-sm font-medium">{feedback.user.firstName} {feedback.user.lastName}</p>
          <p className="text-xs text-muted-foreground">{feedback.user.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-xs text-muted-foreground">{new Date(feedback.createdAt).toLocaleDateString()}</p>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            title="Delete feedback"
            className="rounded p-1 text-muted-foreground hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{feedback.body}</p>
    </div>
  );
}

// ── Verification review card ─────────────────────────────────────────────────

function VerificationReviewCard({
  verification,
  onApproved,
  onRejected,
  onError,
}: {
  verification: TutorVerificationDTO;
  onApproved: () => void;
  onRejected: () => void;
  onError: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approveRating, setApproveRating] = useState(verification.selfRating ?? 3);

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/verification/${verification.id}/approve`, { selfRatingOverride: approveRating }),
    onSuccess: onApproved,
    onError: (err: Error) => onError(err.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/verification/${verification.id}/reject`, { reviewNote: rejectNote }),
    onSuccess: onRejected,
    onError: (err: Error) => onError(err.message || "Failed to reject"),
  });

  const u = verification.user;
  const studentName = u ? `${u.firstName} ${u.lastName}` : "Student";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{studentName}</p>
            {u && <span className="text-xs text-muted-foreground">Grade {u.grade} · {u.email}</span>}
          </div>
          <p className="text-sm text-foreground mt-0.5">
            Subject: <span className="font-medium">{verification.subject.name}</span>
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="capitalize">{verification.evidenceType}</span>
            {verification.gpaOrGrade && <span>Grade/GPA: {verification.gpaOrGrade}</span>}
            <span className="font-medium text-foreground">Confidence: {verification.selfRating}/5</span>
            <span>{new Date(verification.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Student's explanation</p>
            <p className="mt-1 text-sm">{verification.evidenceNote}</p>
          </div>
          {verification.evidenceUrl && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Grade proof</p>
              {(() => {
                const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(verification.evidenceUrl)
                  || verification.evidenceUrl.startsWith("data:image/");
                return isImage ? (
                  verification.evidenceUrl.startsWith("data:") ? (
                    <img
                      src={verification.evidenceUrl}
                      alt="Grade proof"
                      className="max-h-48 rounded-lg border object-contain"
                    />
                  ) : (
                    <a href={verification.evidenceUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={verification.evidenceUrl}
                        alt="Grade proof"
                        className="max-h-48 rounded-lg border object-contain"
                      />
                    </a>
                  )
                ) : (
                  <a
                    href={verification.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-muted px-3 py-2 text-sm text-primary hover:underline"
                  >
                    View proof document ↗
                  </a>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Confidence level for approval */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Set confidence level:</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setApproveRating(i)}
              title={CONFIDENCE_LABELS[i]}
              className={`h-7 w-7 rounded text-xs font-semibold transition-colors ${
                approveRating === i ? "bg-primary text-white" : "border bg-background text-muted-foreground hover:border-primary"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{CONFIDENCE_LABELS[approveRating]}</span>
      </div>

      {/* Actions */}
      {!showRejectForm ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || rejectMutation.isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={approveMutation.isPending || rejectMutation.isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 disabled:opacity-50 hover:bg-red-100 dark:hover:bg-red-950/50"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={2}
            placeholder="Optional: reason for rejection (student will see this)"
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-700"
            >
              {rejectMutation.isPending ? "Rejecting…" : "Confirm Reject"}
            </button>
            <button
              onClick={() => { setShowRejectForm(false); setRejectNote(""); }}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
