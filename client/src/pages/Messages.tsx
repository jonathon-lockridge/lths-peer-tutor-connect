import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Send, MessageSquare, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/shared/EmptyState";

interface MsgUser {
  id: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string | null;
  phone?: string | null;
}

interface Message {
  id: string;
  senderId: string;
  body: string;
  read: boolean;
  createdAt: string;
  sender: { id: string; firstName: string; avatarUrl?: string | null };
}

interface Conversation {
  id: string;
  tutorId: string;
  unreadCount: number;
  tutor: MsgUser;
  request: {
    subject: { name: string };
    requester: MsgUser;
  };
  messages: (Message & { sender: { firstName: string } })[];
}

interface ConversationsResponse {
  conversations: Conversation[];
  currentUserId: string;
}

function Avatar({ user, size = "sm" }: { user: MsgUser; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-9 w-9 text-sm" : "h-10 w-10 text-base";
  return user.avatarUrl ? (
    <img src={user.avatarUrl} className={`${sz} rounded-full object-cover`} alt="" />
  ) : (
    <div className={`${sz} flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white`}>
      {user.firstName[0]}{user.lastName?.[0] ?? ""}
    </div>
  );
}

// ── Conversation List ─────────────────────────────────────────────────────────
export function MessagesPage() {
  const { matchId } = useParams<{ matchId?: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<ConversationsResponse>("/messages"),
    refetchInterval: 10000,
  });

  const conversations = data?.data?.conversations ?? [];
  const currentUserId = data?.data?.currentUserId;

  if (matchId) {
    return <ChatThread matchId={matchId} onBack={() => navigate("/messages")} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-black">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with your tutors and students.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />)}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Once you're matched with a tutor or student, you can message them here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          {conversations.map((c, i) => {
            // Show the OTHER person — if I'm the tutor, show requester; otherwise show tutor
            const otherUser = c.tutorId === currentUserId ? c.request.requester : c.tutor;
            const latest = c.messages[0];
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/messages/${c.id}`)}
                className={`flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition-colors ${
                  i < conversations.length - 1 ? "border-b" : ""
                }`}
              >
                <Avatar user={otherUser} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate">
                      {otherUser.firstName} {otherUser.lastName}
                    </p>
                    {latest && (
                      <p className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {new Date(latest.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.request.subject.name}
                    {latest ? ` · ${latest.sender.firstName}: ${latest.body.slice(0, 40)}` : ""}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Chat Thread ───────────────────────────────────────────────────────────────
function ChatThread({ matchId, onBack }: { matchId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["chat", matchId],
    queryFn: () => api.get<{ match: Conversation; messages: Message[]; currentUserId: string }>(`/messages/${matchId}`),
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => api.post(`/messages/${matchId}`, { body }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["chat", matchId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.data?.messages]);

  const match = data?.data?.match;
  const messages = data?.data?.messages ?? [];
  const currentUserId = data?.data?.currentUserId;

  const otherUser = match
    ? (match.tutor.id === currentUserId ? match.request.requester : match.tutor)
    : null;

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  }

  if (!match) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-white px-2 py-3">
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        {otherUser && <Avatar user={otherUser} size="md" />}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{otherUser?.firstName} {otherUser?.lastName}</p>
          <p className="text-xs text-muted-foreground">{match.request.subject.name}</p>
        </div>
        {otherUser?.phone && (
          <a
            href={`tel:${otherUser.phone}`}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Phone className="h-3.5 w-3.5" />
            {otherUser.phone}
          </a>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No messages yet — say hi!
          </p>
        )}
        {messages.map((m) => {
          const isMe = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  isMe
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-gray-100 text-brand-black rounded-bl-sm"
                }`}
              >
                <p>{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
                  {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message…"
            className="flex-1 rounded-full border bg-gray-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
