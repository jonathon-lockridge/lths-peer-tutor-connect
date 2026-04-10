import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { TutorProfileDTO, TutorAvailabilityDTO } from "@lths/shared";
import { useToast } from "@/components/shared/Toast";
import { GroupedSubjectSelect } from "@/components/shared/GroupedSubjectSelect";

interface Props {
  tutor: TutorProfileDTO;
  onClose: () => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** Return next 7 calendar dates (today+1 through today+7) */
function getNextSevenDays(): Date[] {
  const days: Date[] = [];
  const base = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(d);
  }
  return days;
}

export function BookingModal({ tutor, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();

  const [subjectId, setSubjectId] = useState(tutor.tutorSubjects[0]?.subjectId ?? "");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TutorAvailabilityDTO | null>(null);
  const [note, setNote] = useState("");

  const { data: availabilityData } = useQuery({
    queryKey: ["availability", tutor.id],
    queryFn: () => api.get<TutorAvailabilityDTO[]>(`/availability/${tutor.id}`),
  });
  const availability = availabilityData?.data ?? tutor.availability ?? [];

  const days = getNextSevenDays();
  const availableDayOfWeeks = new Set(availability.map((s) => s.dayOfWeek));

  const slotsForDay = selectedDate
    ? availability.filter((s) => s.dayOfWeek === selectedDate.getDay())
    : [];

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedDate || !selectedSlot) throw new Error("Pick a date and time slot");
      // Build ISO datetime in local time with the slot's start hour
      const d = new Date(selectedDate);
      const [h, m] = selectedSlot.startTime.split(":").map(Number);
      d.setHours(h, m, 0, 0);
      return api.post("/matches", {
        tutorId: tutor.id,
        subjectId,
        scheduledAt: d.toISOString(),
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success(`Booking request sent to ${tutor.firstName}!`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not send booking request"),
  });

  const canSubmit = !!subjectId && !!selectedDate && !!selectedSlot && !mutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Book a Session with {tutor.firstName}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Subject</label>
            <GroupedSubjectSelect
              subjects={tutor.tutorSubjects.map((ts) => ts.subject)}
              value={subjectId}
              onChange={(id) => setSubjectId(id)}
              placeholder="Select a subject..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-background"
            />
          </div>

          {/* Date picker — next 7 days, grayed out if no availability */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Date</label>
            {availability.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tutor.firstName} hasn't set their availability yet. Check back later.
              </p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const dow = d.getDay();
                  const hasSlots = availableDayOfWeeks.has(dow);
                  const isSelected = selectedDate?.toDateString() === d.toDateString();
                  return (
                    <button
                      key={d.toDateString()}
                      disabled={!hasSlots}
                      onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                      className={`flex flex-col items-center rounded-lg py-2 text-xs transition-colors ${
                        isSelected
                          ? "bg-primary text-white"
                          : hasSlots
                          ? "border hover:bg-muted"
                          : "cursor-not-allowed text-muted-foreground/40"
                      }`}
                    >
                      <span className="font-medium">{DAY_NAMES[dow]}</span>
                      <span>{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time slot picker */}
          {selectedDate && slotsForDay.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Available times on {DAY_FULL[selectedDate.getDay()]}
              </label>
              <div className="flex flex-wrap gap-2">
                {slotsForDay.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedSlot?.id === slot.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              What do you need help with? <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Give your tutor a heads-up about what you're working on..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none bg-background"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
          >
            {mutation.isPending ? "Sending..." : "Send Booking Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
