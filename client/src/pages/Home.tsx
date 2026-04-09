import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { Calendar, Clock, BookOpen, ArrowRight, Star, MessageSquare, Inbox, Check, X, Zap, Video } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, formatMinutes } from "@/lib/utils";
import { StatCardSkeleton } from "@/components/shared/LoadingSkeletons";
import { MatchDTO, HourSummaryDTO, TutoringRequestDTO, UserDTO } from "@lths/shared";
import { useToast } from "@/components/shared/Toast";

export function HomePage() {
  const { user } = useUser();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<UserDTO>("/auth/me"),
  });

  const { data: hours, isLoading: hoursLoading } = useQuery({
    queryKey: ["hours"],
    queryFn: () => api.get<HourSummaryDTO>("/hours"),
  });

  const { data: matchesData } = useQuery({
    queryKey: ["matches-tutor"],
    queryFn: () => api.get<MatchDTO[]>("/matches?role=tutor"),
  });

  const { data: requests } = useQuery({
    queryKey: ["my-requests"],
    queryFn: () => api.get<TutoringRequestDTO[]>("/requests?mine=true"),
  });

  const [confirmDeclineId, setConfirmDeclineId] = useState<string | null>(null);

  const declineMutation = useMutation({
    mutationFn: (id: string) => api.post(`/matches/${id}/decline`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matches-tutor"] }); setConfirmDeclineId(null); toast.info("Request declined"); },
    onError: () => toast.error("Could not decline"),
  });

  const firstName = user?.firstName ?? "Cavalier";
  const totalMinutes = hours?.data?.totalMinutes ?? 0;
  const isTutor = me?.data?.isTutor ?? false;

  const allMatches = matchesData?.data ?? [];
  const pendingMatches = allMatches.filter((m) => m.status === "PENDING");
  // Upcoming = accepted matches with a scheduled time in the future
  const upcomingMatches = allMatches.filter(
    (m) => m.status === "ACCEPTED" && m.scheduledAt && new Date(m.scheduledAt) > new Date()
  );
  const pendingRequests = requests?.data?.filter((r) => r.status === "OPEN" || r.status === "MATCHED") ?? [];

  // Next upcoming match (sorted by scheduled time)
  const nextMatch = upcomingMatches
    .slice()
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0] ?? null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-8 text-white">
        {/* Subtle geometric accent */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-6 right-10 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <h1 className="text-2xl font-bold">Hey, {firstName}! 👋</h1>
          <p className="mt-1 text-white/80 text-sm">Cavaliers Helping Cavaliers</p>
          <div className="mt-5 flex gap-3">
            <Link
              to="/find-tutor"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
            >
              Find a Tutor
            </Link>
            <Link
              to="/my-requests"
              className="rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              My Requests
            </Link>
          </div>
        </div>
      </div>

      {/* Next session highlight — derived from accepted matches with future scheduledAt */}
      {nextMatch && (
        <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next Session</p>
            </div>
            <button
              onClick={() => navigate(`/messages/${nextMatch.id}`)}
              className="flex items-center gap-1 rounded-lg border border-primary/20 px-2.5 py-1 text-xs text-primary hover:bg-primary/5"
            >
              <MessageSquare className="h-3 w-3" /> Message
            </button>
          </div>
          <p className="font-semibold text-foreground">{nextMatch.request.subject.name}</p>
          <p className="text-sm text-muted-foreground">
            with {nextMatch.tutor.firstName} {nextMatch.tutor.lastName}
            {nextMatch.location ? ` · ${nextMatch.location}` : ""}
          </p>
          {nextMatch.scheduledAt && (
            <p className="mt-1.5 text-sm font-semibold text-primary">{formatDateTime(nextMatch.scheduledAt)}</p>
          )}
          {nextMatch.meetingUrl && (
            <a
              href={nextMatch.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Video className="h-4 w-4" /> Join Meeting
            </a>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {hoursLoading ? (
          <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1.5">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <p className="text-xl font-bold text-foreground">{formatMinutes(totalMinutes)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Hours</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1.5">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <p className="text-xl font-bold text-foreground">{upcomingMatches.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Upcoming</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1.5">
                <BookOpen className="h-3.5 w-3.5" />
              </div>
              <p className="text-xl font-bold text-foreground">{pendingRequests.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Requests</p>
            </div>
          </>
        )}
      </div>

      {/* Tutor inbox — pending match requests */}
      {pendingMatches.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Tutor Inbox</h2>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {pendingMatches.length}
            </span>
          </div>
          <div className="space-y-3">
            {pendingMatches.map((m) => (
              <PendingMatchCard
                key={m.id}
                match={m}
                onDecline={() => setConfirmDeclineId(m.id)}
                declining={declineMutation.isPending && declineMutation.variables === m.id}
              />
            ))}
          </div>

          {/* Decline confirmation dialog */}
          {confirmDeclineId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
                <h3 className="font-semibold text-foreground">Decline this request?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  The student will be notified and their request will go back to open so another tutor can help.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => declineMutation.mutate(confirmDeclineId)}
                    disabled={declineMutation.isPending}
                    className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-700"
                  >
                    {declineMutation.isPending ? "Declining…" : "Yes, Decline"}
                  </button>
                  <button
                    onClick={() => setConfirmDeclineId(null)}
                    className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Upcoming sessions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
          <Link to="/sessions" className="flex items-center gap-1 text-sm text-primary hover:underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {upcomingMatches.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-muted-foreground">No upcoming sessions yet.</p>
            <Link to="/find-tutor" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Find a tutor →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingMatches.slice(0, 3).map((m) => (
              <div key={m.id} className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{m.request.subject.name}</p>
                  <p className="text-xs text-muted-foreground">
                    with {m.tutor.firstName} {m.tutor.lastName}
                    {m.location ? ` · ${m.location}` : ""}
                  </p>
                </div>
                {m.scheduledAt && (
                  <p className="text-xs font-medium text-primary shrink-0">{formatDateTime(m.scheduledAt)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Become a Tutor CTA — only show if not already a tutor */}
      {!isTutor && (
        <div className="rounded-xl border bg-gradient-to-br from-gray-50 to-white p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-950/40">
            <Star className="h-6 w-6 text-yellow-500" />
          </div>
          <h3 className="font-semibold text-foreground">Become a Tutor</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your knowledge, earn volunteer hours, and build your transcript.
          </p>
          <Link
            to="/profile?apply=true"
            className="mt-4 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Apply to Tutor
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Pending Match Card ────────────────────────────────────────────────────────
function PendingMatchCard({
  match,
  onDecline,
  declining,
}: {
  match: MatchDTO;
  onDecline: () => void;
  declining: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [accepting, setAccepting] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");

  // Minimum datetime-local value = now (prevent scheduling in past)
  const minDateTime = new Date().toISOString().slice(0, 16);

  const acceptMutation = useMutation({
    mutationFn: () =>
      api.post(`/matches/${match.id}/accept`, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        location,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches-tutor"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Match accepted! The student has been notified.");
    },
    onError: (e: Error) => toast.error(e?.message ?? "Could not accept match"),
  });

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{match.request.subject.name}</p>
          <p className="text-sm text-muted-foreground">
            From {match.request.requester.firstName} {match.request.requester.lastName} · Grade {match.request.requester.grade}
          </p>
          {match.request.description && (
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{match.request.description}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          New
        </span>
      </div>

      {accepting ? (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Date & Time *</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Location *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Library Room 2, Cafeteria, Virtual/Zoom"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={!scheduledAt || !location || acceptMutation.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
            >
              <Check className="h-4 w-4" />
              {acceptMutation.isPending ? "Confirming…" : "Confirm"}
            </button>
            <button
              onClick={() => setAccepting(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setAccepting(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Check className="h-4 w-4" /> Accept
          </button>
          <button
            onClick={onDecline}
            disabled={declining}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-950/30 disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Decline
          </button>
        </div>
      )}
    </div>
  );
}
