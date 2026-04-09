import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserButton } from "@clerk/clerk-react";
import { useRef, useState, useEffect } from "react";
import { Bell, BellOff, CheckCircle2, Clock, XCircle, MessageSquare, Upload, FileImage, X, GraduationCap, ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { UserDTO, SubjectDTO, TutorSubjectDTO, TutorVerificationDTO, VerificationStatus } from "@lths/shared";
import { useToast } from "@/components/shared/Toast";

export function ProfilePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

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

  const initials = `${user.firstName[0]}${user.lastName[0]}`;
  const pendingVerifications = myVerifications.filter((v) => v.status !== "APPROVED");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      {/* User info card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} className="h-16 w-16 rounded-full object-cover" alt="" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
              {initials}
            </div>
          )}
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
              Get notified about session reminders, new messages, and request updates.
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
      </div>

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
  const [gpaOrGrade, setGpaOrGrade] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const apiBase = (import.meta.env.VITE_API_URL ?? "") + "/api";
      const res = await fetch(`${apiBase}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setUploadedFile({ name: file.name, url: json.data.url });
    } catch (err: any) {
      onError(err.message || "Upload failed");
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
        evidenceUrl: uploadedFile!.url,
        gpaOrGrade: gpaOrGrade || undefined,
      }),
    onSuccess,
    onError: (err: Error) => onError(err.message || "Failed to submit application"),
  });

  const sortedSubjects = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
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
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Choose a subject…</option>
              {sortedSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
                {uploading ? "Uploading…" : "Upload Skyward screenshot or PDF (max 5MB)"}
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
