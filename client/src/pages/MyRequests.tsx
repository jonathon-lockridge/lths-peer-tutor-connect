import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequestCardSkeleton } from "@/components/shared/LoadingSkeletons";
import { RequestModal } from "@/components/requests/RequestModal";
import { TutoringRequestDTO } from "@lths/shared";
import { formatDate, urgencyColor, statusColor } from "@/lib/utils";

export function MyRequestsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-requests"],
    queryFn: () => api.get<TutoringRequestDTO[]>("/requests?mine=true"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/requests/${id}/status`, { status: "CANCELLED" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-requests"] }); toast.success("Request cancelled"); },
    onError: () => toast.error("Could not cancel request"),
  });

  const allRequests = data?.data ?? [];
  const requests = allRequests.filter((r) => r.status !== "CANCELLED");
  const cancelled = allRequests.filter((r) => r.status === "CANCELLED");
  const [showCancelled, setShowCancelled] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the help you've asked for.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <RequestCardSkeleton key={i} />)}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No requests yet"
          description="Need help in a class? Post a request and we'll connect you with a fellow Cavalier."
          action={
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Post a Request
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">{r.subject.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(r.status)}`}>
                    {r.status.replace("_", " ")}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${urgencyColor(r.urgency)}`}>
                    {r.urgency}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Posted {formatDate(r.createdAt)}</p>
                {(r.status === "OPEN" || r.status === "MATCHED") && (
                  <button
                    onClick={() => cancelMutation.mutate(r.id)}
                    disabled={cancelMutation.isPending}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancelled requests collapsed section */}
      {cancelled.length > 0 && (
        <div>
          <button
            onClick={() => setShowCancelled(!showCancelled)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showCancelled ? "Hide" : "Show"} {cancelled.length} cancelled request{cancelled.length !== 1 ? "s" : ""}
          </button>
          {showCancelled && (
            <div className="mt-2 space-y-2 opacity-60">
              {cancelled.map((r) => (
                <div key={r.id} className="rounded-xl border bg-card p-4">
                  <p className="text-sm font-medium line-through">{r.subject.name}</p>
                  <p className="text-xs text-muted-foreground">Cancelled · {formatDate(r.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && <RequestModal tutor={null} onClose={() => setShowModal(false)} />}
    </div>
  );
}
