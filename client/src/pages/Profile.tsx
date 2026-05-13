import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserButton } from "@clerk/clerk-react";
import { useRef, useState, useEffect } from "react";
import { Bell, BellOff, CheckCircle2, Clock, XCircle, MessageSquare, Upload, FileImage, X, GraduationCap, ChevronRight, Camera, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { fmt12 } from "@/lib/utils";
import { UserDTO, SubjectDTO, TutorSubjectDTO, TutorVerificationDTO, VerificationStatus, TutorAvailabilityDTO, TutoringMode } from "@lths/shared";
import { useToast } from "@/components/shared/Toast";
import { GroupedSubjectSelect } from "@/components/shared/GroupedSubjectSelect";

/** Resize an image file to maxSize×maxSize, return base64 JPEG data URL */
function resizeImageToBase64(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<UserDTO>("/auth/me"),
  });

  const { data: mySubjects } = useQuery({
    queryKey: ["tutor-subjects"],
    queryFn: () => api.get<TutorSubjectDTO[]>("/tutor-subjects"),
  });

  const { data: allSubjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get<SubjectDTO[]>("/subjects"),
  });

  const { data: verifications } = useQuery({
    queryKey: ["verifications-mine"],
    queryFn: () => api.get<TutorVerificationDTO[]>("/verification/mine"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserDTO>) => api.patch("/users/me", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); setEditing(false); toast.success("Profile saved!"); },
    onError: () => toast.error("Failed to save profile"),
  });

  const { data: notificationsData, refetch: refetchNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ notifications: { id: string; title: string; body: string; read: boolean; createdAt: string }[]; unreadCount: number }>("/notifications"),
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => { refetchNotifications(); },
  });

  const deleteAllNotificationsMutation = useMutation({
    mutationFn: () => api.delete("/notifications"),
    onSuccess: () => { refetchNotifications(); toast.success("All notifications cleared"); },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
    setAvatarUploading(true);
    try {
      // Resize to max 240px and encode as base64 JPEG — stored directly in DB (no file server needed)
      const dataUrl = await resizeImageToBase64(file, 240);
      await updateMutation.mutateAsync({ avatarUrl: dataUrl });
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to upload image");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  // Auto-open apply modal if ?apply=true in URL
  useEffect(() => {
    if (searchParams.get("apply") === "true") {
      setShowApplyModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const user = me?.data;
  const subjects = mySubjects?.data ?? [];
  const myVerifications = verifications?.data ?? [];
  const allSubs = allSubjects?.data ?? [];

  const pendingSubjectIds = new Set(myVerifications.map((v) => v.subjectId));
  const approvedSubjectIds = new Set(subjects.map((ts) => ts.subjectId));
  const takenSubjectIds = new Set([...pendingSubjectIds, ...approvedSubjectIds]);
  const availableForVerification = allSubs.filter((s) => !takenSubjectIds.has(s.id));

  if (!user) return null;

  const initials = `${user.firstName[0] ?? "?"}${user.lastName[0] ?? ""}`;
  const pendingVerifications = myVerifications.filter((v) => v.status !== "APPROVED");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      {/* User info card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          {/* Avatar with upload button */}
          <div className="relative shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} className="h-16 w-16 rounded-full object-cover" alt="" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                {initials}
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              title="Change profile picture"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border shadow hover:bg-muted transition-colors disabled:opacity-50"
            >
              {avatarUploading ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <Camera className="h-3 w-3 text-foreground" />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{user.firstName} {user.lastName}</h2>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            <p className="text-sm text-muted-foreground">Grade {user.grade} · {user.role}</p>
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>

        {user.bio && <p className="mt-4 text-sm text-muted-foreground">{user.bio}</p>}
        {user.phone && <p className="mt-1 text-sm text-muted-foreground">📱 {user.phone}</p>}

        <button
          onClick={() => setEditing(!editing)}
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          {editing ? "Cancel" : "Edit Profile"}
        </button>

        {editing && (
          <EditProfileForm user={user} onSave={(data) => updateMutation.mutate(data)} saving={updateMutation.isPending} />
        )}
      </div>

      {/* Notifications */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-4 font-semibold">Notifications</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">In-app notifications</p>
            <p className="text-xs text-muted-foreground">
              Get notified about session reminders, new messages, and updates.
            </p>
          </div>
          <button
            onClick={() => updateMutation.mutate({ notificationsEnabled: !user.notificationsEnabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              user.notificationsEnabled !== false ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                user.notificationsEnabled !== false ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {user.notificationsEnabled !== false ? (
            <><Bell className="h-3.5 w-3.5 text-primary" /> Notifications are on</>
          ) : (
            <><BellOff className="h-3.5 w-3.5" /> Notifications are off</>
          )}
        </div>

        {/* Notification history with delete */}
        {(() => {
          const notifs = notificationsData?.data?.notifications ?? [];
          if (notifs.length === 0) return (
            <p className="mt-4 text-sm text-muted-foreground border-t pt-4">No notifications yet.</p>
          );
          return (
            <div className="mt-4 border-t pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">History</p>
                <button
                  onClick={() => deleteAllNotificationsMutation.mutate()}
                  disabled={deleteAllNotificationsMutation.isPending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Delete All
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {notifs.map((n) => (
                  <div key={n.id} className={`flex items-start gap-3 rounded-lg px-3 py-2 ${n.read ? "bg-muted/40" : "bg-primary/5 border border-primary/20"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteNotificationMutation.mutate(n.id)}
                      className="shrink-0 rounded p-1 hover:bg-muted text-muted-foreground hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tutor Availability */}
      {user.isTutor && (
        <AvailabilitySection userId={user.id} />
      )}

      {/* Tutor Status */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Tutor Status</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            user.isTutor
              ? "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300"
              : "bg-muted text-muted-foreground"
          }`}>
            {user.isTutor ? "Active Tutor" : "Not a Tutor"}
          </span>
        </div>

        {/* Approved subjects */}
        {subjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approved Subjects</p>
            {subjects.map((ts) => (
              <div key={ts.id} className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">{ts.subject.name}</p>
                  <p className="text-xs text-green-700 dark:text-green-400">Confidence: {ts.selfRating}/5{ts.teacherEndorsed ? " · Teacher Endorsed" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending / rejected applications */}
        {pendingVerifications.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Applications</p>
            {pendingVerifications.map((v) => (
              <VerificationStatusRow key={v.id} verification={v} />
            ))}
          </div>
        )}

        {/* Apply CTA */}
        {availableForVerification.length > 0 ? (
          <button
            onClick={() => setShowApplyModal(true)}
            className="flex w-full items-center justify-between rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {user.isTutor ? "Add another subject" : "Become a Tutor"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Apply to tutor a subject — an admin reviews within a few days
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
          </button>
        ) : (
          subjects.length === 0 && pendingVerifications.length === 0 && (
            <p className="text-sm text-muted-foreground">All subjects are already pending or approved.</p>
          )
        )}
      </div>

      {/* App Feedback */}
      <AppFeedbackForm />

      {/* Apply to Tutor Modal */}
      {showApplyModal && (
        <TutorApplyModal
          subjects={availableForVerification}
          onClose={() => setShowApplyModal(false)}
          onSuccess={() => {
            setShowApplyModal(false);
            qc.invalidateQueries({ queryKey: ["verifications-mine"] });
            toast.success("Application submitted! An admin will review it soon.");
          }}
          onError={(msg) => toast.error(msg)}
        />
      )}
    </div>
  );
}

// ── Tutor Availability Section ────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MODE_OPTIONS: { value: TutoringMode; label: string; icon: string }[] = [
  { value: "PHYSICAL", label: "In-Person", icon: "📍" },
  { value: "ONLINE", label: "Online", icon: "💻" },
  { value: "EITHER", label: "Either", icon: "↕️" },
];

const MODE_COLORS: Record<TutoringMode, string> = {
  PHYSICAL: "bg-blue-500/80 dark:bg-blue-600/70 border-blue-600 dark:border-blue-500",
  ONLINE: "bg-green-500/80 dark:bg-green-600/70 border-green-600 dark:border-green-500",
  EITHER: "bg-primary/70 border-primary",
};

// Hours to show: 7 AM through 9 PM (inclusive start, 30-min rows)
const GRID_START_HOUR = 7;
const GRID_END_HOUR = 21; // 9 PM, exclusive end
const SLOT_DURATION_HOURS = 1; // default 1-hour slots on click
const ROW_COUNT = (GRID_END_HOUR - GRID_START_HOUR) * 2; // 30-min rows

function rowToHHMM(row: number): string {
  const totalMinutes = GRID_START_HOUR * 60 + row * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hhmmToRow(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h * 60 + m - GRID_START_HOUR * 60) / 30;
}

function AvailabilitySection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [newMode, setNewMode] = useState<TutoringMode>("EITHER");
  // pending click: { dayOfWeek, startTime } waiting for end-time selection
  const [pendingStart, setPendingStart] = useState<{ day: number; startRow: number } | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["availability", userId],
    queryFn: () => api.get<TutorAvailabilityDTO[]>(`/availability/${userId}`),
  });

  const addMutation = useMutation({
    mutationFn: (payload: { dayOfWeek: number; startTime: string; endTime: string; mode: TutoringMode }) =>
      api.post("/availability", payload),
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ["availability", userId] });
      toast.success("Slot added!");
    },
    onError: (e: Error) => toast.error(e.message || "Could not add slot"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/availability/${id}`),
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ["availability", userId] });
    },
    onError: () => toast.error("Could not remove slot"),
  });

  const slots = data?.data ?? [];

  // Map: `${dayOfWeek}-${row}` → slot occupying that cell
  const cellToSlot: Record<string, TutorAvailabilityDTO> = {};
  for (const slot of slots) {
    const startRow = hhmmToRow(slot.startTime);
    const endRow = hhmmToRow(slot.endTime);
    for (let r = startRow; r < endRow; r++) {
      cellToSlot[`${slot.dayOfWeek}-${r}`] = slot;
    }
  }

  function handleCellClick(day: number, row: number) {
    const key = `${day}-${row}`;
    const existing = cellToSlot[key];

    if (existing) {
      // Delete existing slot
      deleteMutation.mutate(existing.id);
      return;
    }

    if (!pendingStart) {
      // First click: mark start
      setPendingStart({ day, startRow: row });
    } else if (pendingStart.day !== day) {
      // Different day — reset
      setPendingStart({ day, startRow: row });
    } else if (row <= pendingStart.startRow) {
      // Clicked before or at start — reset
      setPendingStart({ day, startRow: row });
    } else {
      // Second click in same day and after start — create slot
      const startTime = rowToHHMM(pendingStart.startRow);
      const endTime = rowToHHMM(row); // end = clicked row (not inclusive)
      addMutation.mutate({ dayOfWeek: day, startTime, endTime, mode: newMode });
      setPendingStart(null);
    }
  }

  function isPending(day: number, row: number) {
    if (!pendingStart || pendingStart.day !== day) return false;
    return row >= pendingStart.startRow;
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">My Availability</h3>
        {pendingStart && (
          <button
            onClick={() => setPendingStart(null)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Cancel selection
          </button>
        )}
      </div>

      {/* Mode selector */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">New slots as:</span>
        <div className="flex gap-1.5">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setNewMode(opt.value)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                newMode === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:border-primary"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Instruction hint */}
      <p className="mb-3 text-xs text-muted-foreground">
        {pendingStart
          ? `Click an end-time cell on ${DAY_NAMES_FULL[pendingStart.day]} to finish the slot.`
          : "Click a cell to start a slot, click again to set the end time. Click an existing slot to remove it."}
      </p>

      {/* Weekly grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          {/* Day headers */}
          <div className="mb-1 grid" style={{ gridTemplateColumns: "3rem repeat(7, 1fr)" }}>
            <div />
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Time rows */}
          <div className="grid" style={{ gridTemplateColumns: "3rem repeat(7, 1fr)" }}>
            {Array.from({ length: ROW_COUNT }, (_, row) => {
              const hhmm = rowToHHMM(row);
              const isHour = hhmm.endsWith(":00");
              return (
                <>
                  {/* Time label — only on full hours */}
                  <div
                    key={`label-${row}`}
                    className="flex items-start justify-end pr-1.5 text-[10px] text-muted-foreground/60"
                    style={{ height: "18px" }}
                  >
                    {isHour ? fmt12(hhmm) : ""}
                  </div>
                  {/* Day cells */}
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const key = `${day}-${row}`;
                    const slot = cellToSlot[key];
                    const isFirst = slot && hhmmToRow(slot.startTime) === row;
                    const pending = isPending(day, row);
                    const isPendingStart = pendingStart?.day === day && pendingStart?.startRow === row;

                    return (
                      <div
                        key={`cell-${day}-${row}`}
                        onClick={() => handleCellClick(day, row)}
                        title={slot ? `${fmt12(slot.startTime)}–${fmt12(slot.endTime)} (click to delete)` : `${DAY_NAMES_FULL[day]} ${fmt12(hhmm)} — click to start`}
                        className={`relative cursor-pointer border-b border-r text-[9px] transition-colors ${
                          isHour ? "border-t border-muted" : "border-muted/40"
                        } ${
                          slot
                            ? `${MODE_COLORS[slot.mode ?? "EITHER"]} text-white`
                            : pending
                            ? "bg-primary/25 dark:bg-primary/20"
                            : isPendingStart
                            ? "bg-primary/40"
                            : "hover:bg-muted/60"
                        }`}
                        style={{ height: "18px" }}
                      >
                        {isFirst && slot && (
                          <span className="absolute left-0.5 top-0 leading-none truncate max-w-full font-medium text-white/90">
                            {MODE_OPTIONS.find((o) => o.value === slot.mode)?.icon}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {MODE_OPTIONS.map((opt) => (
          <span key={opt.value} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-4 rounded-sm border ${MODE_COLORS[opt.value]}`} />
            {opt.icon} {opt.label}
          </span>
        ))}
        {slots.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {slots.length} slot{slots.length !== 1 ? "s" : ""} set
          </span>
        )}
      </div>
    </div>
  );
}

// ── Verification status badge row ────────────────────────────────────────────

const statusConfig: Record<VerificationStatus, { icon: React.ReactNode; color: string; label: string }> = {
  PENDING: {
    icon: <Clock className="h-4 w-4 shrink-0 text-yellow-600" />,
    color: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
    label: "Pending review",
  },
  APPROVED: {
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />,
    color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    label: "Approved",
  },
  REJECTED: {
    icon: <XCircle className="h-4 w-4 shrink-0 text-red-500" />,
    color: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    label: "Not approved",
  },
};

function VerificationStatusRow({ verification }: { verification: TutorVerificationDTO }) {
  const cfg = statusConfig[verification.status];
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${cfg.color}`}>
      {cfg.icon}
      <div className="flex-1">
        <p className="text-sm font-medium">{verification.subject.name}</p>
        <p className="text-xs text-muted-foreground">{cfg.label}</p>
        {verification.status === "REJECTED" && verification.reviewNote && (
          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">Reason: {verification.reviewNote}</p>
        )}
      </div>
    </div>
  );
}

// ── Tutor Apply Modal ─────────────────────────────────────────────────────────

function TutorApplyModal({
  subjects,
  onClose,
  onSuccess,
  onError,
}: {
  subjects: SubjectDTO[];
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [selfRating, setSelfRating] = useState(3);
  const [gpaOrGrade, setGpaOrGrade] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const CONFIDENCE_LABELS = ["", "Beginner", "Developing", "Comfortable", "Strong", "Expert"];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onError("File must be under 5 MB"); return; }
    setUploading(true);
    try {
      // Resize to max 600px — keeps grade text legible while staying well under the server's JSON limit
      const dataUrl = await resizeImageToBase64(file, 600);
      setUploadedFile({ name: file.name, dataUrl });
    } catch {
      onError("Could not read file");
    } finally {
      setUploading(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post("/verification", {
        subjectId,
        evidenceType: "screenshot",
        evidenceNote,
        evidenceUrl: uploadedFile!.dataUrl,
        gpaOrGrade: gpaOrGrade || undefined,
        selfRating,
      }),
    onSuccess,
    onError: (err: Error) => onError(err.message || "Failed to submit application"),
  });

  const canSubmit = subjectId && evidenceNote.trim().length >= 10 && !!uploadedFile && !uploading && !submitMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Apply to Become a Tutor</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Pick a subject you're strong in, enter your grade, and explain why you'd be a good tutor. An admin will approve within a few days.
          </p>

          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Subject <span className="text-red-500">*</span></label>
            <GroupedSubjectSelect
              subjects={subjects}
              value={subjectId}
              onChange={setSubjectId}
              placeholder="Choose a subject…"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Confidence level */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Confidence level <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelfRating(i)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    selfRating === i
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {selfRating}/5 — {CONFIDENCE_LABELS[selfRating]}
            </p>
          </div>

          {/* Grade */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Your grade in this subject <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              value={gpaOrGrade}
              onChange={(e) => setGpaOrGrade(e.target.value)}
              placeholder='e.g. "A", "95", "4.0 GPA"'
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Why are you good */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Why are you a good tutor for this? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Tell us about your experience — what grade you got, what level class you took, and how you'd explain it to someone struggling…"
              className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-0.5 text-right text-xs text-muted-foreground">{evidenceNote.length}/1000</p>
          </div>

          {/* Required proof screenshot */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Proof of grade <span className="text-red-500">*</span>
              <span className="ml-1 text-xs font-normal text-muted-foreground">— Skyward screenshot, report card, or test score</span>
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              Take a screenshot of your grade in Skyward or a recent test/assignment. This helps admins verify quickly.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploadedFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2.5">
                <FileImage className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                <span className="flex-1 truncate text-sm text-green-800 dark:text-green-300">{uploadedFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="shrink-0 text-green-600 dark:text-green-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Reading…" : "Upload Skyward screenshot or PDF (max 5MB)"}
              </button>
            )}
          </div>

          {/* Submit */}
          {!uploadedFile && (
            <p className="text-center text-xs text-amber-600 dark:text-amber-400">
              A proof screenshot is required before you can submit.
            </p>
          )}
          <button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Application"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit profile form ─────────────────────────────────────────────────────────

function EditProfileForm({
  user,
  onSave,
  saving,
}: {
  user: UserDTO;
  onSave: (data: Partial<UserDTO>) => void;
  saving: boolean;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [grade, setGrade] = useState(user.grade);
  const [bio, setBio] = useState(user.bio ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">First Name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Last Name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Grade</label>
        <select value={grade} onChange={(e) => setGrade(Number(e.target.value) as 9 | 10 | 11 | 12)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          {[9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}th Grade</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Phone <span className="font-normal text-muted-foreground">(optional — visible to matched tutors/students)</span></label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="512-555-0100" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Bio <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <button
        onClick={() => onSave({ firstName, lastName, grade, bio: bio || null, phone: phone || null })}
        disabled={saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

// ── App Feedback Form ─────────────────────────────────────────────────────────

function AppFeedbackForm() {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post("/feedback", { body }),
    onSuccess: () => {
      setSubmitted(true);
      setBody("");
      toast.success("Thanks for your feedback!");
    },
    onError: (e: Error) => toast.error(e.message || "Could not submit feedback"),
  });

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">App Feedback</h3>
      </div>

      {submitted ? (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-300">
          ✓ Feedback received — thank you for helping improve the app!
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Have a suggestion, spotted a bug, or just want to say something? We read everything.
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Your feedback…"
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{body.length}/500</span>
            <button
              onClick={() => mutation.mutate()}
              disabled={body.trim().length < 5 || mutation.isPending}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
            >
              {mutation.isPending ? "Sending…" : "Send Feedback"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
