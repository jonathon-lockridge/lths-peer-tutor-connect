import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Clock, List, CalendarDays, ChevronLeft, ChevronRight, Video, KeyRound, Star, X, RefreshCw, ClipboardList, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/shared/EmptyState";
import { SessionDTO, UserDTO, MatchDTO, TutorAvailabilityDTO } from "@lths/shared";
import { formatDate, formatDateTime, formatMinutes, fmt12 } from "@/lib/utils";
import { useToast } from "@/components/shared/Toast";

type View = "list" | "calendar";

const SESSION_MODE_BADGE: Record<string, string> = {
  PHYSICAL: "📍 In-Person",
  ONLINE: "💻 Online",
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export function MySessionsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState<View>("list");

  const { data, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api.get<SessionDTO[]>("/sessions"),
  });

  // Fetch all matches (both as tutor and tutee) so tutors see their sessions too
  const { data: matchesData } = useQuery({
    queryKey: ["matches", "all"],
    queryFn: () => api.get<MatchDTO[]>("/matches"),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<UserDTO>("/auth/me"),
  });

  const cancelMutation = useMutation({
    mutationFn: (matchId: string) => api.post(`/matches/${matchId}/cancel`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success("Session cancelled.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not cancel session"),
  });

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [reschedulingMatch, setReschedulingMatch] = useState<MatchDTO | null>(null);
  const [loggingMatch, setLoggingMatch] = useState<MatchDTO | null>(null);
  const [showCancelAllConfirm, setShowCancelAllConfirm] = useState(false);

  const cancelAllMutation = useMutation({
    mutationFn: () => api.post("/matches/cancel-all", {}),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      const count = res?.data?.count ?? 0;
      toast.success(count > 0 ? `Cancelled ${count} upcoming session${count !== 1 ? "s" : ""}.` : "No sessions to cancel.");
      setShowCancelAllConfirm(false);
    },
    onError: (e: Error) => toast.error(e.message || "Could not cancel all sessions"),
  });
  const confirmMutation = useMutation({
    mutationFn: ({ id, code }: { id: string; code?: string }) => {
      setConfirmingId(id);
      return api.post(`/sessions/${id}/confirm`, { code });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session confirmed! Hours will be credited once both parties confirm.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not confirm session"),
    onSettled: () => setConfirmingId(null),
  });

  const sessions = data?.data ?? [];
  const allMatches = matchesData?.data ?? [];
  const currentUserId = me?.data?.id;
  const today = new Date();
  const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Upcoming sessions: PENDING or ACCEPTED matches with a future scheduledAt
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const upcomingSessions = allMatches.filter(
    (m) =>
      (m.status === "PENDING" || m.status === "ACCEPTED") &&
      m.scheduledAt &&
      new Date(m.scheduledAt) > today
  );

  // Past ACCEPTED matches that haven't been logged as sessions yet
  const loggedMatchIds = new Set(sessions.map((s) => s.matchId));
  const needsLogging = allMatches.filter(
    (m) =>
      m.status === "ACCEPTED" &&
      m.scheduledAt &&
      new Date(m.scheduledAt) <= today &&
      !loggedMatchIds.has(m.id)
  );

  // Past accepted matches where the current user was the student — prompt for reviews
  // Fetch which tutors the user has already reviewed so we don't show a stale prompt
  const reviewedTutorIds = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => api.get<{ tutorId: string }[]>("/reviews/mine"),
    enabled: !!currentUserId,
  });
  const alreadyReviewedIds = new Set((reviewedTutorIds.data?.data ?? []).map((r) => r.tutorId));

  const pendingReviews = (() => {
    const seenTutors = new Set<string>();
    return allMatches.filter((m) => {
      if (!currentUserId) return false;
      if (m.tutorId === currentUserId) return false;
      if (m.status !== "ACCEPTED") return false;
      if (!m.scheduledAt || new Date(m.scheduledAt) >= today) return false;
      if (alreadyReviewedIds.has(m.tutorId)) return false; // already reviewed this tutor
      if (seenTutors.has(m.tutorId)) return false;
      seenTutors.add(m.tutorId);
      return true;
    });
  })();

  const upcoming = sessions.filter((s) => s.date.slice(0, 10) >= todayStr);
  const past = sessions.filter((s) => s.date.slice(0, 10) < todayStr);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Sessions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and confirm your tutoring sessions.
          </p>
        </div>
        <div className="flex rounded-lg border bg-card p-1">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "list" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "calendar" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendar
          </button>
        </div>
      </div>

      {/* Upcoming sessions (PENDING / ACCEPTED matches) */}
      {upcomingSessions.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming Sessions
            </h2>
            {me?.data?.isTutor && upcomingSessions.some((m) => m.tutorId === currentUserId) && (
              <button
                onClick={() => setShowCancelAllConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Cancel All
              </button>
            )}
          </div>
          <div className="space-y-3">
            {upcomingSessions.map((m) => {
              const subjectName = m.request?.subject?.name ?? m.subject?.name ?? "Session";
              const iAmTutor = m.tutorId === currentUserId;
              const studentUser = m.request?.requester ?? m.student ?? null;
              const otherName = iAmTutor
                ? `${studentUser?.firstName ?? ""} ${studentUser?.lastName ?? ""}`.trim()
                : `${m.tutor.firstName} ${m.tutor.lastName}`;
              const canCancel = !!m.scheduledAt && new Date(m.scheduledAt) > twoHoursFromNow;
              return (
                <div key={m.id} className="rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{subjectName}</p>
                      <p className="text-sm text-muted-foreground">
                        with {otherName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m.sessionMode && SESSION_MODE_BADGE[m.sessionMode] && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {SESSION_MODE_BADGE[m.sessionMode]}
                        </span>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.status === "ACCEPTED"
                          ? "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300"
                          : "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300"
                      }`}>
                        {m.status === "ACCEPTED" ? "Confirmed" : "Pending"}
                      </span>
                    </div>
                  </div>

                  {m.scheduledAt && (
                    <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDateTime(m.scheduledAt)}</span>
                    </div>
                  )}

                  {m.location && m.location !== "TBD" && (
                    <p className="mt-1 text-sm text-muted-foreground">📍 {m.location}</p>
                  )}

                  {m.meetingUrl && m.status === "ACCEPTED" && m.sessionMode !== "PHYSICAL" && (
                    <a
                      href={m.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 rounded-lg border-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                    >
                      <Video className="h-4 w-4" /> Join Meeting
                    </a>
                  )}

                  {m.note && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{m.note}</p>
                  )}

                  {m.status === "ACCEPTED" || m.status === "PENDING" ? (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => canCancel && setReschedulingMatch(m)}
                        disabled={!canCancel}
                        title={!canCancel ? "Cannot reschedule within 2 hours of session start" : undefined}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-800 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reschedule
                      </button>
                      <button
                        onClick={() => canCancel && cancelMutation.mutate(m.id)}
                        disabled={!canCancel || cancelMutation.isPending}
                        title={!canCancel ? "Cannot cancel within 2 hours of session start" : undefined}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Log Session prompts — ACCEPTED past matches with no session logged yet */}
      {needsLogging.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sessions to Log
          </h2>
          <div className="space-y-2">
            {needsLogging.map((m) => {
              const subjectName = m.request?.subject?.name ?? m.subject?.name ?? "Session";
              const iAmTutor = m.tutorId === currentUserId;
              const otherName = iAmTutor
                ? (() => { const s = m.request?.requester ?? m.student; return s ? `${s.firstName} ${s.lastName}` : ""; })()
                : `${m.tutor.firstName} ${m.tutor.lastName}`;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-teal-900 dark:text-teal-300">
                      {subjectName} with {otherName}
                    </p>
                    <p className="text-xs text-teal-700 dark:text-teal-400 mt-0.5">
                      {m.scheduledAt ? formatDateTime(m.scheduledAt) : ""} · Log to credit your hours
                    </p>
                  </div>
                  <button
                    onClick={() => setLoggingMatch(m)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 dark:bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Log Session
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Review prompts — shown for past sessions where user is student */}
      {pendingReviews.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Rate Your Sessions
          </h2>
          <div className="space-y-2">
            {pendingReviews.map((m) => {
              const subjectName = m.request?.subject?.name ?? m.subject?.name ?? "Session";
              return (
                <Link
                  key={m.id}
                  to={`/tutors/${m.tutorId}`}
                  className="flex items-center justify-between rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                      How was your session with {m.tutor.firstName}?
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                      {subjectName} · {m.scheduledAt ? formatDateTime(m.scheduledAt) : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="h-4 w-4 text-amber-400" />
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : view === "calendar" ? (
        <MonthCalendar
          sessions={sessions}
          currentUserId={currentUserId}
          onConfirm={(id, code) => confirmMutation.mutate({ id, code })}
          confirmingId={confirmingId}
        />
      ) : sessions.length === 0 && upcomingSessions.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No sessions yet"
          description="Your tutoring sessions will appear here. Each confirmed session automatically tracks your hours."
        />
      ) : sessions.length > 0 ? (
        <ListView
          upcoming={upcoming}
          past={past}
          currentUserId={currentUserId}
          onConfirm={(id, code) => confirmMutation.mutate({ id, code })}
          confirmingId={confirmingId}
        />
      ) : null}

      {reschedulingMatch && (
        <RescheduleModal
          match={reschedulingMatch}
          onClose={() => setReschedulingMatch(null)}
        />
      )}

      {loggingMatch && (
        <LogSessionModal
          match={loggingMatch}
          onClose={() => setLoggingMatch(null)}
        />
      )}

      {showCancelAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-1 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold text-foreground">Cancel all upcoming sessions?</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              This will cancel all of your PENDING and ACCEPTED sessions scheduled more than 2 hours from now. Students will be notified and their requests will reopen.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => cancelAllMutation.mutate()}
                disabled={cancelAllMutation.isPending}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-700"
              >
                {cancelAllMutation.isPending ? "Cancelling…" : "Yes, Cancel All"}
              </button>
              <button
                onClick={() => setShowCancelAllConfirm(false)}
                className="flex-1 rounded-lg border py-2.5 text-sm font-medium hover:bg-muted"
              >
                Keep Sessions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Monthly Calendar ──────────────────────────────────────────────────────────
function MonthCalendar({
  sessions,
  currentUserId,
  onConfirm,
  confirmingId,
}: {
  sessions: SessionDTO[];
  currentUserId?: string;
  onConfirm: (id: string, code?: string) => void;
  confirmingId: string | null;
}) {
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);

  const year = current.getFullYear();
  const month = current.getMonth();
  const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const byDate: Record<string, SessionDTO[]> = {};
  for (const s of sessions) {
    const k = s.date.slice(0, 10);
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(s);
  }

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = current.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedSessions = selected ? (byDate[selected] ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="rounded-lg p-1.5 hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-semibold">{monthLabel}</p>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="rounded-lg p-1.5 hover:bg-muted">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <p key={d} className="text-xs font-medium text-muted-foreground">{d}</p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const k = dateKey(year, month, day);
            const hasSessions = !!byDate[k];
            const isToday = k === todayStr;
            const isSelected = k === selected;
            return (
              <button
                key={k}
                onClick={() => setSelected(isSelected ? null : k)}
                className={`relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-sm transition-colors ${
                  isSelected
                    ? "bg-primary text-white"
                    : isToday
                    ? "border-2 border-primary font-bold text-primary"
                    : "hover:bg-muted"
                }`}
              >
                {day}
                {hasSessions && (
                  <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {new Date(selected + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          {selectedSessions.length === 0 ? (
            <p className="rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground">
              No sessions on this day.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedSessions.map((s) => (
                <SessionCard key={s.id} s={s} currentUserId={currentUserId} onConfirm={onConfirm} confirmingId={confirmingId} />
              ))}
            </div>
          )}
        </div>
      )}

      {sessions.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No sessions yet — they'll appear as dots on the calendar once scheduled.
        </p>
      )}
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────
function SessionCard({
  s,
  currentUserId,
  onConfirm,
  confirmingId,
}: {
  s: SessionDTO;
  currentUserId?: string;
  onConfirm: (id: string, code?: string) => void;
  confirmingId: string | null;
}) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const bothConfirmed = s.tutorConfirmed && s.tuteeConfirmed;
  const isTutor = s.match.tutor.id === currentUserId;
  const iAmConfirmed = isTutor ? s.tutorConfirmed : s.tuteeConfirmed;
  const needsMyConfirm = !iAmConfirmed && !bothConfirmed;
  const meetingUrl = s.match.meetingUrl;
  const myCode = iAmConfirmed && !bothConfirmed ? s.confirmCode : undefined;
  const isPast = s.date.slice(0, 10) < new Date().toLocaleDateString("en-CA");

  // Null-safe helpers for both request-based and direct bookings
  const subjectName = s.match.request?.subject?.name ?? s.match.subject?.name ?? "Session";
  const studentUser = s.match.request?.requester ?? s.match.student;
  const sessionMode = s.match.sessionMode;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{subjectName}</p>
          <p className="text-sm text-muted-foreground">
            {s.match.tutor.firstName} {s.match.tutor.lastName}
            {studentUser && <> &amp; {studentUser.firstName} {studentUser.lastName}</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {sessionMode && SESSION_MODE_BADGE[sessionMode] && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {SESSION_MODE_BADGE[sessionMode]}
            </span>
          )}
          {bothConfirmed ? (
            <span className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-950/40 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3" /> Confirmed
            </span>
          ) : (
            <span className="rounded-full bg-yellow-100 dark:bg-yellow-950/40 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-300">
              Pending
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" /> {formatDate(s.date)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {formatMinutes(s.durationMinutes)}
        </span>
      </div>

      {/* Confirmation status breakdown */}
      {!bothConfirmed && (
        <div className="mt-3 flex gap-3 text-xs">
          <span className={`flex items-center gap-1 ${s.tutorConfirmed ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
            <CheckCircle2 className={`h-3.5 w-3.5 ${s.tutorConfirmed ? "text-green-600 dark:text-green-400" : "text-gray-300"}`} />
            Tutor {s.tutorConfirmed ? "confirmed" : "pending"}
          </span>
          <span className={`flex items-center gap-1 ${s.tuteeConfirmed ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
            <CheckCircle2 className={`h-3.5 w-3.5 ${s.tuteeConfirmed ? "text-green-600 dark:text-green-400" : "text-gray-300"}`} />
            Student {s.tuteeConfirmed ? "confirmed" : "pending"}
          </span>
        </div>
      )}

      {s.notes && (
        <div className="mt-2">
          <p className={`text-sm text-muted-foreground ${notesExpanded ? "" : "line-clamp-2"}`}>{s.notes}</p>
          {s.notes.length > 80 && (
            <button onClick={() => setNotesExpanded(!notesExpanded)} className="mt-0.5 text-xs text-primary hover:underline">
              {notesExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Meeting link — only for online sessions */}
      {meetingUrl && sessionMode !== "PHYSICAL" && !bothConfirmed && (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg border-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50"
        >
          <Video className="h-4 w-4" /> Join Meeting
        </a>
      )}

      {/* Confirm code — shown to the person who already confirmed */}
      {myCode && (
        <div className="mt-3 rounded-lg border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3">
          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300">Share this code with the other person to confirm:</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold tracking-widest text-yellow-900 dark:text-yellow-100">{myCode}</span>
            <KeyRound className="h-4 w-4 text-yellow-600" />
          </div>
        </div>
      )}

      {/* Code entry — shown to person who needs to confirm */}
      {needsMyConfirm && (
        <div className="mt-4">
          {!showCodeInput ? (
            <button
              onClick={() => setShowCodeInput(true)}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Confirm My Attendance
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Enter the 4-digit code from the other person:</p>
              <div className="flex gap-2">
                <input
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                  maxLength={4}
                  className="w-24 rounded-lg border px-3 py-2 text-center text-lg font-bold tracking-widest outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={() => { onConfirm(s.id, confirmCode); }}
                  disabled={confirmCode.length !== 4 || confirmingId === s.id}
                  className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
                >
                  {confirmingId === s.id ? "Confirming…" : "Confirm"}
                </button>
                <button onClick={() => setShowCodeInput(false)} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {iAmConfirmed && !bothConfirmed && !myCode && (
        <p className="mt-3 text-xs text-muted-foreground">
          ✓ You confirmed — waiting for the other party.
        </p>
      )}

      {/* Review prompt for past confirmed sessions where current user is the student */}
      {bothConfirmed && !isTutor && isPast && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">How was your session?</p>
          </div>
          <Link
            to={`/tutors/${s.match.tutorId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Leave a review →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Log Session Modal ─────────────────────────────────────────────────────────
function LogSessionModal({ match, onClose }: { match: MatchDTO; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();

  const scheduledDate = match.scheduledAt ? new Date(match.scheduledAt) : new Date();
  const defaultDate = scheduledDate.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const defaultStart = scheduledDate.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  // Default end = 1 hour after start
  const defaultEnd = new Date(scheduledDate.getTime() + 60 * 60 * 1000)
    .toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [notes, setNotes] = useState("");

  const subjectName = match.request?.subject?.name ?? match.subject?.name ?? "Session";

  const mutation = useMutation({
    mutationFn: () => {
      if (!date || !startTime || !endTime) throw new Error("Fill in all required fields");
      if (startTime >= endTime) throw new Error("End time must be after start time");
      // Build full ISO datetimes for startTime/endTime from the date + time inputs
      const startISO = new Date(`${date}T${startTime}:00`).toISOString();
      const endISO = new Date(`${date}T${endTime}:00`).toISOString();
      return api.post("/sessions", {
        matchId: match.id,
        date,
        startTime: startISO,
        endTime: endISO,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success("Session logged! Share the confirmation code with the other person.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not log session"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Log Session</h2>
            <p className="text-sm text-muted-foreground">{subjectName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toLocaleDateString("en-CA")}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Session notes{" "}
              <span className="font-normal text-muted-foreground">(optional — emailed to the student once confirmed)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What did you cover? Any follow-up topics or homework suggestions..."
              className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          You'll receive a 4-digit code to share with the other person for confirmation. Hours are credited once both parties confirm.
        </p>

        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border py-2.5 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !date || startTime >= endTime}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
          >
            {mutation.isPending ? "Logging…" : "Log Session"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reschedule Modal ──────────────────────────────────────────────────────────
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getNextSevenDays(): Date[] {
  const days: Date[] = [];
  const base = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(d);
  }
  return days;
}

function RescheduleModal({ match, onClose }: { match: MatchDTO; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const tutorId = match.tutorId;

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TutorAvailabilityDTO | null>(null);
  const [sessionMode, setSessionMode] = useState<"PHYSICAL" | "ONLINE" | null>(
    (match.sessionMode as "PHYSICAL" | "ONLINE" | null) ?? null
  );

  const { data: availabilityData } = useQuery({
    queryKey: ["availability", tutorId],
    queryFn: () => api.get<TutorAvailabilityDTO[]>(`/availability/${tutorId}`),
  });
  const availability = availabilityData?.data ?? [];

  const { data: bookedData } = useQuery({
    queryKey: ["booked", tutorId],
    queryFn: () => api.get<string[]>(`/matches/booked/${tutorId}`),
    enabled: !!tutorId,
  });
  const bookedTimes = new Set(
    (bookedData?.data ?? [])
      .filter((t) => new Date(t).toISOString() !== (match.scheduledAt ? new Date(match.scheduledAt).toISOString() : ""))
      .map((t) => new Date(t).toISOString())
  );

  const days = getNextSevenDays();
  const availableDayOfWeeks = new Set(availability.map((s) => s.dayOfWeek));
  const slotsForDay = selectedDate ? availability.filter((s) => s.dayOfWeek === selectedDate.getDay()) : [];

  function isSlotTaken(slot: TutorAvailabilityDTO, date: Date): boolean {
    const d = new Date(date);
    const [h, m] = slot.startTime.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return bookedTimes.has(d.toISOString());
  }

  function handleSlotSelect(slot: TutorAvailabilityDTO) {
    setSelectedSlot(slot);
    if (slot.mode !== "EITHER") setSessionMode(slot.mode as "PHYSICAL" | "ONLINE");
    else setSessionMode(null);
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedDate || !selectedSlot) throw new Error("Pick a date and time slot");
      if (isSlotTaken(selectedSlot, selectedDate)) throw new Error("This slot is already taken");
      const d = new Date(selectedDate);
      const [h, m] = selectedSlot.startTime.split(":").map(Number);
      d.setHours(h, m, 0, 0);
      return api.patch(`/matches/${match.id}/reschedule`, { scheduledAt: d.toISOString() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["booked", tutorId] });
      toast.success("Session rescheduled!");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not reschedule session"),
  });

  const modeRequired = selectedSlot?.mode === "EITHER";
  const canSubmit =
    !!selectedDate &&
    !!selectedSlot &&
    !isSlotTaken(selectedSlot, selectedDate) &&
    (!modeRequired || !!sessionMode) &&
    !mutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reschedule Session</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Date picker */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Pick a new date</label>
            {availability.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading availability…</p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const dow = d.getDay();
                  const hasSlots = availableDayOfWeeks.has(dow);
                  const isSelected = selectedDate?.toDateString() === d.toDateString();
                  return (
                    <button
                      key={d.toDateString()}
                      disabled={!hasSlots}
                      onClick={() => { setSelectedDate(d); setSelectedSlot(null); setSessionMode(null); }}
                      className={`flex flex-col items-center rounded-lg py-2 text-xs transition-colors ${
                        isSelected
                          ? "bg-primary text-white"
                          : hasSlots
                          ? "border hover:bg-muted"
                          : "cursor-not-allowed text-muted-foreground/40"
                      }`}
                    >
                      <span className="font-medium">{DAY_NAMES_SHORT[dow]}</span>
                      <span>{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time slot picker */}
          {selectedDate && slotsForDay.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Available times on {DAY_NAMES_FULL[selectedDate.getDay()]}
              </label>
              <div className="flex flex-wrap gap-2">
                {slotsForDay.map((slot) => {
                  const taken = isSlotTaken(slot, selectedDate);
                  const isSelected = selectedSlot?.id === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => !taken && handleSlotSelect(slot)}
                      disabled={taken}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        taken
                          ? "cursor-not-allowed border-dashed bg-muted/30 text-muted-foreground/50 line-through"
                          : isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
                      {taken && <span className="ml-1 text-xs">(taken)</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode picker — only for EITHER slots */}
          {selectedSlot?.mode === "EITHER" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                How would you like to meet? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSessionMode("PHYSICAL")}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    sessionMode === "PHYSICAL" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  📍 In-Person
                </button>
                <button
                  onClick={() => setSessionMode("ONLINE")}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    sessionMode === "ONLINE" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  💻 Online
                </button>
              </div>
            </div>
          )}
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border py-2.5 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
          >
            {mutation.isPending ? "Rescheduling…" : "Confirm Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({
  upcoming,
  past,
  currentUserId,
  onConfirm,
  confirmingId,
}: {
  upcoming: SessionDTO[];
  past: SessionDTO[];
  currentUserId?: string;
  onConfirm: (id: string, code?: string) => void;
  confirmingId: string | null;
}) {
  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Upcoming
          </h2>
          <div className="space-y-3">
            {upcoming.map((s) => (
              <SessionCard key={s.id} s={s} currentUserId={currentUserId} onConfirm={onConfirm} confirmingId={confirmingId} />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Past Sessions
          </h2>
          <div className="space-y-3">
            {past.map((s) => (
              <SessionCard key={s.id} s={s} currentUserId={currentUserId} onConfirm={onConfirm} confirmingId={confirmingId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
