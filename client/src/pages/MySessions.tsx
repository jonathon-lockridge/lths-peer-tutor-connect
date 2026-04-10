import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Clock, List, CalendarDays, ChevronLeft, ChevronRight, Video, KeyRound, Star } from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/shared/EmptyState";
import { SessionDTO, UserDTO } from "@lths/shared";
import { formatDate, formatMinutes } from "@/lib/utils";
import { useToast } from "@/components/shared/Toast";

type View = "list" | "calendar";

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

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<UserDTO>("/auth/me"),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, code }: { id: string; code?: string }) =>
      api.post(`/sessions/${id}/confirm`, { code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session confirmed! Hours will be credited once both parties confirm.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not confirm session"),
  });

  const sessions = data?.data ?? [];
  const currentUserId = me?.data?.id;
  const today = new Date();
  const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

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
          confirming={confirmMutation.isPending}
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No sessions yet"
          description="Your tutoring sessions will appear here. Each confirmed session automatically tracks your hours."
        />
      ) : (
        <ListView
          upcoming={upcoming}
          past={past}
          currentUserId={currentUserId}
          onConfirm={(id, code) => confirmMutation.mutate({ id, code })}
          confirming={confirmMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Monthly Calendar ──────────────────────────────────────────────────────────
function MonthCalendar({
  sessions,
  currentUserId,
  onConfirm,
  confirming,
}: {
  sessions: SessionDTO[];
  currentUserId?: string;
  onConfirm: (id: string, code?: string) => void;
  confirming: boolean;
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
                <SessionCard key={s.id} s={s} currentUserId={currentUserId} onConfirm={onConfirm} confirming={confirming} />
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
  confirming,
}: {
  s: SessionDTO;
  currentUserId?: string;
  onConfirm: (id: string, code?: string) => void;
  confirming: boolean;
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
  const isPast = new Date(s.date) < new Date();

  // Null-safe helpers for both request-based and direct bookings
  const subjectName = s.match.request?.subject?.name ?? s.match.subject?.name ?? "Session";
  const studentUser = s.match.request?.requester ?? s.match.student;

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
        {bothConfirmed ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 dark:bg-green-950/40 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">
            <CheckCircle2 className="h-3 w-3" /> Confirmed
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-yellow-100 dark:bg-yellow-950/40 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-300">
            Pending
          </span>
        )}
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

      {/* Meeting link */}
      {meetingUrl && !bothConfirmed && (
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
                  disabled={confirmCode.length !== 4 || confirming}
                  className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
                >
                  {confirming ? "Confirming…" : "Confirm"}
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

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({
  upcoming,
  past,
  currentUserId,
  onConfirm,
  confirming,
}: {
  upcoming: SessionDTO[];
  past: SessionDTO[];
  currentUserId?: string;
  onConfirm: (id: string, code?: string) => void;
  confirming: boolean;
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
              <SessionCard key={s.id} s={s} currentUserId={currentUserId} onConfirm={onConfirm} confirming={confirming} />
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
              <SessionCard key={s.id} s={s} currentUserId={currentUserId} onConfirm={onConfirm} confirming={confirming} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
