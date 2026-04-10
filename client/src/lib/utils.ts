import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert "HH:MM" 24-hour string to "h:mm AM/PM" display format */
export function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function urgencyColor(urgency: string) {
  return urgency === "HIGH"
    ? "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300"
    : urgency === "MEDIUM"
    ? "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300"
    : "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300";
}

export function statusColor(status: string) {
  const map: Record<string, string> = {
    OPEN: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300",
    MATCHED: "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300",
    IN_PROGRESS: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300",
    COMPLETED: "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300",
    CANCELLED: "bg-muted text-muted-foreground",
    PENDING: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300",
    ACCEPTED: "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300",
    DECLINED: "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300",
    NO_SHOW: "bg-muted text-muted-foreground",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}
