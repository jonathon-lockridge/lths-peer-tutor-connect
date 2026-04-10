import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, SignIn, SignUp } from "@clerk/clerk-react";
import { PageShell } from "@/components/layout/PageShell";
import { HomePage } from "@/pages/Home";
import { FindTutorPage } from "@/pages/FindTutor";
import { MySessionsPage } from "@/pages/MySessions";
import { HoursPage } from "@/pages/Hours";
import { ProfilePage } from "@/pages/Profile";
import { AdminPage } from "@/pages/Admin";
import { TutorProfilePage } from "@/pages/TutorProfile";
import { OnboardingPage } from "@/pages/Onboarding";
import { AnalyticsPage } from "@/pages/Analytics";
import { MessagesPage } from "@/pages/Messages";
import { NotFoundPage } from "@/pages/NotFound";
import { setAuthTokenGetter } from "@/lib/api";
import { ToastProvider } from "@/components/shared/Toast";
import { ThemeProvider } from "@/lib/theme";

// Wires Clerk's session token into every API call
function TokenSetup() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);
  return null;
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
                <p className="mt-0.5 text-sm text-muted-foreground">Lake Travis High School — use your school email to sign up</p>
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
        <Route
          path="/*"
          element={
            <AuthGuard>
              <PageShell>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/find-tutor" element={<FindTutorPage />} />
                  <Route path="/tutors/:id" element={<TutorProfilePage />} />
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
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
    </ThemeProvider>
  );
}
