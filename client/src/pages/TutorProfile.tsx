import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Clock, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { BookingModal } from "@/components/tutors/BookingModal";
import { TutorProfileDTO, BadgeType } from "@lths/shared";
import { useToast } from "@/components/shared/Toast";

const BADGE_STYLES: Record<BadgeType, { label: string; className: string }> = {
  TOP_RATED: { label: "Top Rated", className: "bg-yellow-100 text-yellow-800 border border-yellow-300" },
  RECOMMENDED: { label: "Recommended", className: "bg-blue-100 text-blue-800 border border-blue-300" },
  HIGHLY_SKILLED: { label: "Highly Skilled", className: "bg-green-100 text-green-800 border border-green-300" },
};

interface CanReviewResponse {
  canReview: boolean;
  hasReviewed: boolean;
  existingReview?: {
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
  };
}

interface FullTutorProfile extends TutorProfileDTO {
  recentReviews: {
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
    reviewer: { id: string; firstName: string; lastName: string; avatarUrl?: string | null };
  }[];
}

export function TutorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [showBook, setShowBook] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tutor", id],
    queryFn: () => api.get<FullTutorProfile>(`/users/${id}`),
    enabled: !!id,
  });

  const { data: canReviewData, refetch: refetchCanReview } = useQuery({
    queryKey: ["can-review", id],
    queryFn: () => api.get<CanReviewResponse>(`/reviews/can-review/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const tutor = data?.data;
  if (!tutor) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-lg font-semibold text-foreground">Tutor not found</p>
      <p className="mt-1 text-sm text-muted-foreground">This profile may no longer exist.</p>
      <Link to="/find-tutor" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
        Back to Find a Tutor
      </Link>
    </div>
  );

  const badges = tutor.badges ?? [];
  const canReview = canReviewData?.data;

  return (
    <div className="space-y-6">
      <Link to="/find-tutor" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Find a Tutor
      </Link>

      {/* Header */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-5">
          {tutor.avatarUrl ? (
            <img src={tutor.avatarUrl} className="h-20 w-20 rounded-full object-cover" alt="" />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
              {tutor.firstName[0]}{tutor.lastName[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{tutor.firstName} {tutor.lastName}</h1>
            <p className="text-muted-foreground">Grade {tutor.grade}</p>
            {badges.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <span
                    key={b.id}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLES[b.badge].className}`}
                  >
                    {b.badge === "TOP_RATED" && "⭐ "}
                    {BADGE_STYLES[b.badge].label}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-4 text-sm">
              {tutor.averageRating !== null && (
                <span className="flex items-center gap-1 font-medium text-amber-600">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {tutor.averageRating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {tutor.totalHoursTutored} hrs tutored
              </span>
            </div>
          </div>
        </div>

        {tutor.bio && (
          <p className="mt-4 text-sm text-muted-foreground">{tutor.bio}</p>
        )}

        <button
          onClick={() => setShowBook(true)}
          className="mt-5 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Book a Session with {tutor.firstName}
        </button>
      </div>

      {/* Subjects */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Subjects</h2>
        <div className="flex flex-wrap gap-2">
          {tutor.tutorSubjects.map((ts) => (
            <div key={ts.id} className="rounded-lg border px-3 py-2">
              <p className="text-sm font-medium">{ts.subject.name}</p>
              <p className="text-xs text-muted-foreground">
                Confidence: {ts.selfRating}/5{ts.teacherEndorsed ? " · ✓ Endorsed" : ""}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Student Reviews</h2>
        {tutor.recentReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {tutor.recentReviews.map((r) => (
              <div key={r.id} className="border-b pb-4 last:border-b-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{r.reviewer.firstName} {r.reviewer.lastName}</p>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`}
                      />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Review section */}
        {id && canReview && (
          <div className="mt-4 border-t pt-4">
            {canReview.hasReviewed && canReview.existingReview ? (
              <YourReview
                tutorId={id}
                review={canReview.existingReview}
                onDeleted={refetchCanReview}
              />
            ) : canReview.canReview ? (
              <LeaveReviewForm
                tutorId={id}
                tutorFirstName={tutor.firstName}
                onSubmitted={refetchCanReview}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete a confirmed session with {tutor.firstName} to leave a review.
              </p>
            )}
          </div>
        )}
      </div>

      {showBook && (
        <BookingModal tutor={tutor} onClose={() => setShowBook(false)} />
      )}
    </div>
  );
}

// ── Your Existing Review ──────────────────────────────────────────────────────
function YourReview({
  tutorId,
  review,
  onDeleted,
}: {
  tutorId: string;
  review: { id: string; rating: number; comment?: string | null; createdAt: string };
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/reviews/${review.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tutor", tutorId] });
      toast.success("Review deleted. You can now leave a new one.");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete review"),
  });

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-2">Your review</p>
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`h-4 w-4 ${i <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
        </div>
        {review.comment && <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>}
      </div>
      <button
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
        className="mt-2 text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {deleteMutation.isPending ? "Deleting…" : "Delete review and write a new one"}
      </button>
    </div>
  );
}

// ── Leave a Review Form ───────────────────────────────────────────────────────
function LeaveReviewForm({
  tutorId,
  tutorFirstName,
  onSubmitted,
}: {
  tutorId: string;
  tutorFirstName: string;
  onSubmitted: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const reviewMutation = useMutation({
    mutationFn: () => api.post("/reviews", { tutorId, rating, comment: comment || undefined }),
    onSuccess: () => {
      toast.success("Review submitted! Thank you.");
      qc.invalidateQueries({ queryKey: ["tutor", tutorId] });
      onSubmitted();
    },
    onError: (e: Error) => toast.error(e.message || "Could not submit review"),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Rate your experience with {tutorFirstName}</p>

      {/* Star rating — required */}
      <div>
        <label className="mb-1.5 block text-xs font-medium">Rating <span className="text-red-500">*</span></label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(i)}
              className="focus:outline-none"
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  i <= (hover || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 self-center text-sm text-muted-foreground">
              {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
            </span>
          )}
        </div>
      </div>

      {/* Comment — optional */}
      <div>
        <label className="mb-1 block text-xs font-medium">
          Comment <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder={`How was your session with ${tutorFirstName}?`}
          className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-0.5 text-right text-xs text-muted-foreground">{comment.length}/300</p>
      </div>

      <button
        onClick={() => reviewMutation.mutate()}
        disabled={rating === 0 || reviewMutation.isPending}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
      >
        {reviewMutation.isPending ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  );
}
