import { NavLink } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Search,
  BookOpen,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  BarChart2,
  MessageSquare,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { api } from "@/lib/api";
import { UserDTO, TutorVerificationDTO } from "@lths/shared";
import { useTheme } from "@/lib/theme";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/find-tutor", label: "Find a Tutor", icon: Search },
  { to: "/my-requests", label: "My Requests", icon: BookOpen },
  { to: "/sessions", label: "Sessions", icon: Calendar },
  { to: "/hours", label: "Hours", icon: Clock },
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: User },
];

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<UserDTO>("/auth/me"),
  });
  const isAdmin = me?.data?.role === "ADMIN";

  const { data: pendingData } = useQuery({
    queryKey: ["verifications-pending"],
    queryFn: () => api.get<TutorVerificationDTO[]>("/verification/pending"),
    enabled: isAdmin,
    staleTime: 60000,
  });
  const pendingCount = pendingData?.data?.length ?? 0;

  return (
    <div className="flex h-full flex-col border-r bg-card">
      {/* Brand + dark mode toggle */}
      <div className="flex items-center gap-3 border-b px-4 py-5">
        <img src="/favicon.svg" alt="Logo" className="h-9 w-9 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">Peer Tutor Connect</p>
          <p className="text-xs text-muted-foreground">Cavaliers Helping Cavaliers</p>
        </div>
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <ShieldCheck className="h-4 w-4" />
            Admin
            {pendingCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </NavLink>
        )}
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 border-t px-4 py-4">
        <UserButton afterSignOutUrl="/sign-in" />
        <NotificationBell />
      </div>
    </div>
  );
}
