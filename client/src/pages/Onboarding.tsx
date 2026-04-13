import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [bio, setBio] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post("/auth/onboard", { firstName, lastName, grade, bio: bio || undefined }),
    onSuccess: () => navigate("/"),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-xl">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <img src="/favicon.svg" alt="Logo" className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome, Cavalier!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Let's set up your profile to get started.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">First Name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Emma"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Last Name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Reyes"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Grade <span className="text-red-500">*</span>
            </label>
            <select
              value={grade ?? ""}
              onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="" disabled>Select your grade...</option>
              <option value={9}>9th Grade</option>
              <option value={10}>10th Grade</option>
              <option value={11}>11th Grade</option>
              <option value={12}>12th Grade</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Bio <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Tell other Cavaliers a bit about yourself..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={!firstName || !lastName || grade === null || mutation.isPending}
          className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90"
        >
          {mutation.isPending ? "Setting up..." : "Get Started →"}
        </button>
      </div>
    </div>
  );
}
