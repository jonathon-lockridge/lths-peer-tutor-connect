import { Link } from "react-router-dom";
import { Star, Clock } from "lucide-react";
import { TutorProfileDTO, SubjectCategory, BadgeType } from "@lths/shared";

interface TutorCardProps {
  tutor: TutorProfileDTO;
  onBook?: (tutor: TutorProfileDTO) => void;
}

const CATEGORY_COLORS: Record<SubjectCategory, string> = {
  MATH: "bg-blue-100 text-blue-800",
  SCIENCE: "bg-green-100 text-green-800",
  ENGLISH: "bg-purple-100 text-purple-800",
  HISTORY: "bg-amber-100 text-amber-800",
  WORLD_LANGUAGE: "bg-pink-100 text-pink-800",
  ELECTIVE: "bg-teal-100 text-teal-800",
  AP: "bg-red-100 text-red-800",
  OTHER: "bg-muted text-muted-foreground",
};

const BADGE_STYLES: Record<BadgeType, { label: string; className: string }> = {
  TOP_RATED: { label: "Top Rated", className: "bg-yellow-100 text-yellow-800 border border-yellow-300" },
  RECOMMENDED: { label: "Recommended", className: "bg-blue-100 text-blue-800 border border-blue-300" },
  HIGHLY_SKILLED: { label: "Highly Skilled", className: "bg-green-100 text-green-800 border border-green-300" },
};

export function TutorCard({ tutor, onBook }: TutorCardProps) {
  const initials = `${tutor.firstName[0]}${tutor.lastName[0]}`;
  const badges = tutor.badges ?? [];

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start gap-4">
        {tutor.avatarUrl ? (
          <img
            src={tutor.avatarUrl}
            alt={`${tutor.firstName} ${tutor.lastName}`}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <Link
            to={`/tutors/${tutor.id}`}
            className="block text-base font-semibold text-foreground hover:text-primary truncate"
          >
            {tutor.firstName} {tutor.lastName}
          </Link>
          <p className="text-sm text-muted-foreground">Grade {tutor.grade}</p>
          {badges.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {badges.map((b) => (
                <span
                  key={b.id}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES[b.badge].className}`}
                >
                  {b.badge === "TOP_RATED" && "⭐ "}
                  {BADGE_STYLES[b.badge].label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
          {tutor.averageRating !== null && (
            <span className="flex items-center gap-1 font-semibold text-amber-600">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              {tutor.averageRating.toFixed(1)}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {tutor.totalHoursTutored}h
          </span>
        </div>
      </div>

      {tutor.tutorSubjects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[...tutor.tutorSubjects].sort((a, b) => a.subject.name.localeCompare(b.subject.name)).slice(0, 4).map((ts) => (
            <span
              key={ts.id}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[ts.subject.category]}`}
            >
              {ts.subject.name}
              {ts.teacherEndorsed && <span title="Teacher endorsed">✓</span>}
            </span>
          ))}
          {tutor.tutorSubjects.length > 4 && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              +{tutor.tutorSubjects.length - 4} more
            </span>
          )}
        </div>
      )}

      {tutor.bio && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{tutor.bio}</p>
      )}

      <div className="mt-4 flex gap-2">
        <Link
          to={`/tutors/${tutor.id}`}
          className="flex-1 rounded-lg border px-3 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          View Profile
        </Link>
        {onBook && (
          <button
            onClick={() => onBook(tutor)}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Book Session
          </button>
        )}
      </div>
    </div>
  );
}
