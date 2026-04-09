import { NavLink, useNavigate } from "react-router-dom";
import { Home, Search, Calendar, MessageSquare, User, MoreHorizontal, BookOpen, Clock, BarChart2, X } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { NotificationBell } from "@/components/notifications/NotificationBell";

function useUnreadMessages() {
  const { data } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<{ conversations: { unreadCount: number }[]; currentUserId: string }>("/messages"),
    staleTime: 30000,
  });
  return (data?.data?.conversations ?? []).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
}

const PRIMARY_TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/find-tutor", label: "Find", icon: Search },
  { to: "/sessions", label: "Sessions", icon: Calendar },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: User },
];

const MORE_ITEMS = [
  { to: "/my-requests", label: "My Requests", icon: BookOpen },
  { to: "/hours", label: "Volunteer Hours", icon: Clock },
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
];

export function BottomBar() {
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();
  const unreadMessages = useUnreadMessages();

  return (
    <>
      {/* More sheet overlay */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowMore(false)}
          />
          <div className="fixed bottom-[64px] left-0 right-0 z-50 rounded-t-2xl border-t bg-white px-4 pb-6 pt-3 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-brand-black">More</p>
              <button onClick={() => setShowMore(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
                <button
                  key={to}
                  onClick={() => { navigate(to); setShowMore(false); }}
                  className="flex flex-col items-center gap-2 rounded-xl border bg-gray-50 py-4 text-xs font-medium text-brand-black hover:bg-gray-100 transition-colors"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom nav */}
      <nav className="flex border-t bg-white shadow-lg safe-area-inset-bottom">
        {PRIMARY_TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {label === "Messages" && unreadMessages > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </div>
            {label}
          </NavLink>
        ))}
        {/* Notifications slot */}
        <div className="flex flex-1 flex-col items-center justify-center py-3">
          <NotificationBell />
        </div>
        <button
          onClick={() => setShowMore(!showMore)}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition-colors",
            showMore ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>
    </>
  );
}
