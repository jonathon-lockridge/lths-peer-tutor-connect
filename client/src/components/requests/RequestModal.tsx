import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { TutorProfileDTO, SubjectDTO } from "@lths/shared";
import { useToast } from "@/components/shared/Toast";

interface Props {
  tutor: TutorProfileDTO | null;
  onClose: () => void;
}

export function RequestModal({ tutor, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [subjectId, setSubjectId] = useState(tutor?.tutorSubjects[0]?.subjectId ?? "");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get<SubjectDTO[]>("/subjects"),
    enabled: !tutor,
  });

  const subjectOptions = [...(tutor
    ? tutor.tutorSubjects.map((ts) => ts.subject)
    : subjects?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/requests", {
        subjectId,
        description,
        urgency,
        ...(tutor ? { targetTutorId: tutor.id } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      toast.success(tutor ? `Request sent to ${tutor.firstName}!` : "Request posted!");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not submit request"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {tutor ? `Request Help from ${tutor.firstName}` : "Post a Request"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a subject...</option>
              {subjectOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">What do you need help with?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Be specific — the more detail you give, the better your tutor can prepare."
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <div className="mt-1 flex justify-between">
              {description.length < 10 && description.length > 0 && (
                <p className="text-xs text-amber-600">{10 - description.length} more character{10 - description.length !== 1 ? "s" : ""} needed</p>
              )}
              {description.length === 0 && <span />}
              {description.length >= 10 && <span />}
              <p className="text-xs text-muted-foreground ml-auto">{description.length}/1000</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Urgency</label>
            <div className="flex gap-3">
              {(["LOW", "MEDIUM", "HIGH"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUrgency(u)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    urgency === u
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  {u.charAt(0) + u.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!subjectId || description.length < 10 || mutation.isPending}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
          >
            {mutation.isPending ? "Sending..." : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
