import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users, Clock, BookOpen, TrendingUp, Download, CheckCircle2, XCircle, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { TutorVerificationDTO, TutorProfileDTO } from "@lths/shared";
import { StatCardSkeleton } from "@/components/shared/LoadingSkeletons";
import { useToast } from "@/components/shared/Toast";

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

export function AdminPage() {
  const qc = useQueryClient();
  const toast = useToast();

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

  const { data: tutorsData } = useQuery({
    queryKey: ["tutors"],
    queryFn: () => api.get<TutorProfileDTO[]>("/users/tutors"),
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
  const tutors = tutorsData?.data ?? [];

  const handleExport = async (period?: string) => {
    const url = `${import.meta.env.VITE_API_URL ?? ""}/api/hours/export${period ? `?period=${encodeURIComponent(period)}` : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `volunteer-hours${period ? `-${period}` : ""}.csv`;
    a.click();
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
        <h2 className="mb-3 font-semibold">Export Volunteer Hours</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Download a CSV of all logged volunteer hours. This will mark records as exported.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleExport()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Export All Hours
          </button>
          <button
            onClick={() => handleExport(`${new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0)}-${new Date().getFullYear() + (new Date().getMonth() < 6 ? 0 : 1)} ${new Date().getMonth() < 6 ? "Spring" : "Fall"}`)}
            className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Export Current Semester
          </button>
        </div>
      </div>
      {/* Tutor Confidence Levels */}
      {tutors.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-1 font-semibold">Tutor Confidence Levels</h2>
          <p className="mb-4 text-sm text-muted-foreground">Edit the confidence rating for any tutor's subject.</p>
          <div className="space-y-3">
            {tutors.map((tutor) =>
              tutor.tutorSubjects.map((ts) => (
                <ConfidenceEditor
                  key={ts.id}
                  tutorSubjectId={ts.id}
                  tutorName={`${tutor.firstName} ${tutor.lastName}`}
                  subjectName={ts.subject.name}
                  currentRating={ts.selfRating}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["tutors"] })}
                />
              ))
            )}
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
              <div key={f.id} className="rounded-lg border bg-muted p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{f.user.firstName} {f.user.lastName}</p>
                  <p className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</p>
                </div>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Confidence level editor ───────────────────────────────────────────────────

function ConfidenceEditor({
  tutorSubjectId,
  tutorName,
  subjectName,
  currentRating,
  onSaved,
}: {
  tutorSubjectId: string;
  tutorName: string;
  subjectName: string;
  currentRating: number;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(currentRating);

  const mutation = useMutation({
    mutationFn: (r: number) => api.patch(`/admin/tutor-subjects/${tutorSubjectId}`, { selfRating: r }),
    onSuccess: () => { toast.success(`Updated ${tutorName} — ${subjectName} to ${rating}/5`); onSaved(); },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{tutorName}</p>
        <p className="text-xs text-muted-foreground truncate">{subjectName}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setRating(i)}
              className={`h-7 w-7 rounded text-xs font-semibold transition-colors ${
                rating === i ? "bg-primary text-white" : "border bg-background text-muted-foreground hover:border-primary"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
        <button
          onClick={() => mutation.mutate(rating)}
          disabled={mutation.isPending || rating === currentRating}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:opacity-90"
        >
          {mutation.isPending ? "…" : "Save"}
        </button>
      </div>
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

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/verification/${verification.id}/approve`, {}),
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
