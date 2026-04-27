import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, SignIn, SignUp } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { HomePage } from "@/pages/Home";
import { FindTutorPage } from "@/pages/FindTutor";
import { MySessionsPage } from "@/pages/MySessions";
import { HoursPage } from "@/pages/Hours";
import { ProfilePage } from "@/pages/Profile";
import { AdminPage } from "@/pages/Admin";
import { TutorProfilePage } from "@/pages/TutorProfile";
import { OnboardingPage } from "@/pages/Onboarding";
import { TermsPage } from "@/pages/Terms";
import { AnalyticsPage } from "@/pages/Analytics";
import { MessagesPage } from "@/pages/Messages";
import { NotFoundPage } from "@/pages/NotFound";
import { setAuthTokenGetter, api } from "@/lib/api";
import { ToastProvider } from "@/components/shared/Toast";
import { ThemeProvider } from "@/lib/theme";
import type { UserDTO } from "@lths/shared";

// Wires Clerk's session token into every API call
function TokenSetup() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

function TermsGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<UserDTO>("/auth/me"),
  });
  const [accepted, setAccepted] = useState(false);
  const mutation = useMutation({
    mutationFn: () => api.post("/auth/accept-terms", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const user = data?.data;
  if (user && !user.termsAcceptedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <img src="/favicon.svg" alt="Logo" className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We've added Terms of Service to Peer Tutor Connect. Please review and accept to continue.
          </p>
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm text-primary underline underline-offset-2 hover:opacity-80"
          >
            Read Terms of Service ↗
          </a>
          <div className="mt-5 flex items-start gap-2.5 text-left">
            <input
              type="checkbox"
              id="tg"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border accent-primary"
            />
            <label htmlFor="tg" className="cursor-pointer text-sm text-muted-foreground">
              I have read and agree to the Terms of Service
            </label>
          </div>
          {mutation.isError && (
            <p className="mt-2 text-sm text-red-600">{(mutation.error as Error).message}</p>
          )}
          <button
            onClick={() => mutation.mutate()}
            disabled={!accepted || mutation.isPending}
            className="mt-5 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90"
          >
            {mutation.isPending ? "Saving..." : "Accept & Continue →"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <BrowserRouter>
      <TokenSetup />
      <Routes>
        <Route
          path="/sign-in/*"
          element={
            <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-10">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
                  <img src="/favicon.svg" alt="Logo" className="h-8 w-8" />
                </div>
                <h1 className="text-xl font-bold text-foreground">Peer Tutor Connect</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">Lake Travis High School · Cavaliers Helping Cavaliers</p>
              </div>
              <SignIn routing="path" path="/sign-in" afterSignInUrl="/" />
            </div>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-10">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
                  <img src="/favicon.svg" alt="Logo" className="h-8 w-8" />
                </div>
                <h1 className="text-xl font-bold text-foreground">Join Peer Tutor Connect</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">Lake Travis High School — Cavaliers Helping Cavaliers</p>
              </div>
              <SignUp routing="path" path="/sign-up" afterSignUpUrl="/onboarding" />
            </div>
          }
        />
        <Route
          path="/onboarding"
          element={
            <AuthGuard>
              <OnboardingPage />
            </AuthGuard>
          }
        />
        {/* Public browsing routes — no auth required */}
        <Route
          path="/"
          element={<PageShell><HomePage /></PageShell>}
        />
        <Route
          path="/find-tutor"
          element={<PageShell><FindTutorPage /></PageShell>}
        />
        <Route
          path="/terms"
          element={<PageShell><TermsPage /></PageShell>}
        />
        <Route
          path="/tutors/:id"
          element={<PageShell><TutorProfilePage /></PageShell>}
        />

        {/* Protected routes — require sign-in + T&C acceptance */}
        <Route
          path="/*"
          element={
            <AuthGuard>
              <TermsGate>
                <PageShell>
                  <Routes>
                    <Route path="/sessions" element={<MySessionsPage />} />
                    <Route path="/hours" element={<HoursPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/messages" element={<MessagesPage />} />
                    <Route path="/messages/:matchId" element={<MessagesPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </PageShell>
              </TermsGate>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
    </ThemeProvider>
  );
}
