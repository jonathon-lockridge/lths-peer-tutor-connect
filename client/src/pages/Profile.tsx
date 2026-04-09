import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserButton } from "@clerk/clerk-react";
import { useRef, useState } from "react";
import { Bell, BellOff, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, MessageSquare, Upload, FileImage, X } from "lucide-react";
import { api } from "@/lib/api";
import { UserDTO, SubjectDTO, TutorSubjectDTO, TutorVerificationDTO, VerificationStatus } from "@lths/shared";
import { useToast } from "@/components/shared/Toast";

export function ProfilePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [showVerifyForm, setShowVerifyForm] = useState(false);

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

  const user = me?.data;
  const subjects = mySubjects?.data ?? [];
  const myVerifications = verifications?.data ?? [];
  const allSubs = allSubjects?.data ?? [];

  // Subjects not yet verified or pending
  const verifiedSubjectIds = new Set(myVerifications.map((v) => v.subjectId));
  const availableForVerification = allSubs.filter((s) => !verifiedSubjectIds.has(s.id));

  if (!user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-black">Profile</h1>

      {/* User info card */}
      <div className="rounded-xl border bg-white p-6">
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
      <div className="rounded-xl border bg-white p-6">
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
              user.notificationsEnabled !== false ? "bg-primary" : "bg-gray-300"
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

      {/* Tutor status + subjects */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Tutor Status</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            user.isTutor ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
          }`}>
            {user.isTutor ? "Active Tutor" : "Not a Tutor"}
          </span>
        </div>

        {/* Approved subjects list */}
        {subjects.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approved Subjects</p>
            {subjects.map((ts) => (
              <div key={ts.id} className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">{ts.subject.name}</p>
                  <p className="text-xs text-green-700">Confidence: {ts.selfRating}/5{ts.teacherEndorsed ? " · Teacher Endorsed" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending / rejected verifications */}
        {myVerifications.filter((v) => v.status !== "APPROVED").length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Applications</p>
            {myVerifications.filter((v) => v.status !== "APPROVED").map((v) => (
              <VerificationStatusRow key={v.id} verification={v} />
            ))}
          </div>
        )}

        {/* Submit new verification */}
        {availableForVerification.length > 0 && (
          <div className="border-t pt-4">
            <button
              onClick={() => setShowVerifyForm(!showVerifyForm)}
              className="flex w-full items-center justify-between text-sm font-medium text-primary hover:opacity-80"
            >
              <span>Apply to tutor a new subject</span>
              {showVerifyForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
              Submit your grades or Skyward evidence. An admin will review and approve within a few days.
            </p>

            {showVerifyForm && (
              <TutorVerificationForm
                subjects={availableForVerification}
                onSuccess={() => {
                  setShowVerifyForm(false);
                  qc.invalidateQueries({ queryKey: ["verifications-mine"] });
                  toast.success("Application submitted! An admin will review it soon.");
                }}
                onError={(msg) => toast.error(msg)}
              />
            )}
          </div>
        )}

        {availableForVerification.length === 0 && myVerifications.length === 0 && subjects.length === 0 && (
          <p className="text-sm text-muted-foreground">All subjects already covered or pending review.</p>
        )}
      </div>

      {/* App Feedback */}
      <AppFeedbackForm />
    </div>
  );
}

// ── Verification status badge row ────────────────────────────────────────────

const statusConfig: Record<VerificationStatus, { icon: React.ReactNode; color: string; label: string }> = {
  PENDING: {
    icon: <Clock className="h-4 w-4 shrink-0 text-yellow-600" />,
    color: "bg-yellow-50 border-yellow-200",
    label: "Pending review",
  },
  APPROVED: {
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />,
    color: "bg-green-50 border-green-200",
    label: "Approved",
  },
  REJECTED: {
    icon: <XCircle className="h-4 w-4 shrink-0 text-red-500" />,
    color: "bg-red-50 border-red-200",
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
          <p className="mt-0.5 text-xs text-red-600">Reason: {verification.reviewNote}</p>
        )}
      </div>
    </div>
  );
}

// ── Verification form ────────────────────────────────────────────────────────

function TutorVerificationForm({
  subjects,
  onSuccess,
  onError,
}: {
  subjects: SubjectDTO[];
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [evidenceType, setEvidenceType] = useState<"grades" | "skyward" | "screenshot" | "other">("grades");
  const [gpaOrGrade, setGpaOrGrade] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
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
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setUploadedFile({ name: file.name, url: json.data.url });
      setEvidenceUrl(json.data.url);
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
        evidenceType,
        evidenceNote,
        evidenceUrl: evidenceUrl || undefined,
        gpaOrGrade: gpaOrGrade || undefined,
      }),
    onSuccess,
    onError: (err: Error) => onError(err.message || "Failed to submit application"),
  });

  const sortedSubjects = [...subjects].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div>
        <label className="mb-1 block text-xs font-medium">Subject *</label>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select a subject…</option>
          {sortedSubjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Evidence type *</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["grades", "skyward", "screenshot", "other"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setEvidenceType(t); setUploadedFile(null); setEvidenceUrl(""); }}
              className={`rounded-lg border py-2 text-xs font-medium capitalize transition-colors ${
                evidenceType === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {t === "skyward" ? "Skyward" : t === "screenshot" ? "Screenshot" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">
          Grade / GPA <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          value={gpaOrGrade}
          onChange={(e) => setGpaOrGrade(e.target.value)}
          placeholder='e.g. "A", "95", "4.2 GPA"'
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Evidence attachment — file upload for screenshot, URL for others */}
      {evidenceType === "screenshot" ? (
        <div>
          <label className="mb-1 block text-xs font-medium">
            Screenshot <span className="font-normal text-muted-foreground">(image or PDF, max 5MB)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          {uploadedFile ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 px-3 py-2.5">
              <FileImage className="h-4 w-4 shrink-0 text-green-600" />
              <span className="flex-1 truncate text-sm text-green-800">{uploadedFile.name}</span>
              <button
                type="button"
                onClick={() => { setUploadedFile(null); setEvidenceUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="shrink-0 text-green-600 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Click to upload a screenshot or PDF"}
            </button>
          )}
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium">
            Evidence URL <span className="font-normal text-muted-foreground">(optional — Google Drive, Skyward, etc.)</span>
          </label>
          <input
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
            type="url"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium">
          Explain your proficiency *{" "}
          <span className="font-normal text-muted-foreground">(min 10 chars)</span>
        </label>
        <textarea
          value={evidenceNote}
          onChange={(e) => setEvidenceNote(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Describe your experience with this subject — grades, class level, how you'd help others…"
          className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-0.5 text-right text-xs text-muted-foreground">{evidenceNote.length}/1000</p>
      </div>

      <button
        onClick={() => submitMutation.mutate()}
        disabled={!subjectId || evidenceNote.length < 10 || uploading || submitMutation.isPending}
        className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
      >
        {submitMutation.isPending ? "Submitting…" : "Submit Application"}
      </button>
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
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Last Name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Grade</label>
        <select value={grade} onChange={(e) => setGrade(Number(e.target.value) as 9 | 10 | 11 | 12)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          {[9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}th Grade</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Phone <span className="font-normal text-muted-foreground">(optional — visible to matched tutors/students)</span></label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="512-555-0100" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Bio <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
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
    <div className="rounded-xl border bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">App Feedback</h3>
      </div>

      {submitted ? (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
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
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
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
