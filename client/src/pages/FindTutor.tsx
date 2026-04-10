import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { TutorCard } from "@/components/tutors/TutorCard";
import { TutorCardSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { TutorProfileDTO, SubjectDTO } from "@lths/shared";
import { BookingModal } from "@/components/tutors/BookingModal";
import { GroupedSubjectSelect } from "@/components/shared/GroupedSubjectSelect";

export function FindTutorPage() {
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [bookTarget, setBookTarget] = useState<TutorProfileDTO | null>(null);

  const { data: tutors, isLoading } = useQuery({
    queryKey: ["tutors", search, subjectFilter, gradeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (subjectFilter) params.set("subjectId", subjectFilter);
      if (gradeFilter) params.set("grade", gradeFilter);
      return api.get<TutorProfileDTO[]>(`/users/tutors?${params.toString()}`);
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get<SubjectDTO[]>("/subjects"),
  });

  const hasFilters = search || subjectFilter || gradeFilter;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Find a Tutor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect with a fellow Cavalier who's got your back.
        </p>
      </div>

      {/* Search & filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-3">
          <GroupedSubjectSelect
            subjects={subjects?.data ?? []}
            value={subjectFilter}
            onChange={setSubjectFilter}
            includeAllOption
            className="flex-1 rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="w-32 rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Grades</option>
            <option value="9">9th</option>
            <option value="10">10th</option>
            <option value="11">11th</option>
            <option value="12">12th</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(""); setSubjectFilter(""); setGradeFilter(""); }}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <TutorCardSkeleton key={i} />)}
        </div>
      ) : tutors?.data?.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No tutors found"
          description="Try adjusting your filters or check back later — more Cavaliers are signing up every day."
          action={
            hasFilters ? (
              <button
                onClick={() => { setSearch(""); setSubjectFilter(""); setGradeFilter(""); }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Clear Filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tutors?.data?.map((tutor) => (
            <TutorCard
              key={tutor.id}
              tutor={tutor}
              onBook={setBookTarget}
            />
          ))}
        </div>
      )}

      {bookTarget && (
        <BookingModal
          tutor={bookTarget}
          onClose={() => setBookTarget(null)}
        />
      )}
    </div>
  );
}
