import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Copy, Mail, MailOpen, Search, Trash2 } from "lucide-react";
import { isValidEmail } from "../../lib/safeUrl";
import { deleteMessage, setMessageStatus, type InboxMessage } from "../adminData";
import { commitTitle, useAdminSession } from "../session";

type FilterMode = "all" | "unread" | "read";

export function InboxSection({ messages }: { messages: InboxMessage[] }) {
  const { actor, toast, confirm, handleError } = useAdminSession();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((msg) => {
      if (filter === "unread" && msg.status !== "unread") return false;
      if (filter === "read" && msg.status !== "read") return false;
      if (!q) return true;
      return (
        msg.name.toLowerCase().includes(q) ||
        msg.email.toLowerCase().includes(q) ||
        msg.message.toLowerCase().includes(q)
      );
    });
  }, [messages, filter, search]);

  const unreadCount = messages.filter((m) => m.status === "unread").length;

  const toggleStatus = async (msg: InboxMessage) => {
    setBusyId(msg.id);
    const next = msg.status === "unread" ? "read" : "unread";
    try {
      await setMessageStatus(msg.id, next);
      toast({ kind: "info", title: `Marked as ${next}`, detail: `Message from ${msg.name}` });
    } catch (err) {
      handleError(err, "update message status");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (msg: InboxMessage) => {
    const ok = await confirm({
      title: `Delete message from ${msg.name}?`,
      message: "This permanently deletes the message from Firestore and logs the deletion in your audit trail.",
      confirmLabel: "Delete permanently",
      danger: true,
    });
    if (!ok) return;

    setBusyId(msg.id);
    try {
      await deleteMessage(msg, actor);
      toast({ kind: "success", title: commitTitle("delete inbox message"), detail: `Removed message from ${msg.name}.` });
    } catch (err) {
      handleError(err, "delete message");
    } finally {
      setBusyId(null);
    }
  };

  const copyEmail = async (msg: InboxMessage) => {
    try {
      await navigator.clipboard.writeText(msg.email);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ kind: "error", title: "Could not copy email" });
    }
  };

  return (
    <>
      <div className="adm-section-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <h1 style={{ margin: 0 }}>Contact Inbox</h1>
            <span className={`adm-pill ${unreadCount > 0 ? "is-warn" : "is-ok"}`}>
              {unreadCount} unread · {messages.length} total
            </span>
          </div>
          <p>
            Messages submitted through your portfolio&apos;s Contact form arrive here in real time. Visitors can only
            create messages — only your verified Google UID can read or delete them.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
        <div className="adm-tabs" role="tablist" aria-label="Filter messages">
          {(["all", "unread", "read"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={filter === mode}
              className={`adm-tab${filter === mode ? " is-active" : ""}`}
              onClick={() => setFilter(mode)}
            >
              {mode === "all"
                ? `All (${messages.length})`
                : mode === "unread"
                  ? `Unread (${unreadCount})`
                  : `Read (${messages.length - unreadCount})`}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <Search
            size={14}
            aria-hidden="true"
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--sc-ink-soft)" }}
          />
          <input
            type="search"
            className="adm-input"
            style={{ paddingLeft: 34 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sender, email, message..."
            aria-label="Search messages"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="adm-card" style={{ textAlign: "center", padding: 36 }}>
          <p style={{ margin: 0, color: "var(--sc-ink-soft)", fontSize: 14 }}>
            {messages.length === 0
              ? "No contact messages yet. Submissions from your portfolio contact form will show up here live."
              : "No messages match your current filter."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {filtered.map((msg) => (
            <article key={msg.id} className={`adm-msg-card${msg.status === "unread" ? " is-unread" : ""}`}>
              <div className="adm-card-head">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 16 }}>{msg.name}</strong>
                    <span className={`adm-pill ${msg.status === "unread" ? "is-warn" : ""}`}>{msg.status}</span>
                  </div>
                  <div className="adm-mono" style={{ fontSize: 12, color: "var(--sc-ink-soft)", marginTop: 2 }}>
                    {msg.email}
                    {msg.createdAt ? ` · ${msg.createdAt.toLocaleString()}` : ""}
                  </div>
                </div>

                <div className="adm-card-controls">
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={() => void copyEmail(msg)}
                    title="Copy sender email"
                  >
                    {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedId === msg.id ? "Copied" : "Email"}</span>
                  </button>
                  {isValidEmail(msg.email) && (
                    <a
                      href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: Hello from ${msg.name}`)}`}
                      className="adm-btn adm-btn-sm adm-btn-primary"
                    >
                      <span>Reply</span>
                      <ArrowUpRight size={13} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={() => void toggleStatus(msg)}
                    disabled={busyId === msg.id}
                  >
                    {msg.status === "unread" ? <MailOpen size={13} /> : <Mail size={13} />}
                    <span>{msg.status === "unread" ? "Mark read" : "Mark unread"}</span>
                  </button>
                  <button
                    type="button"
                    className="adm-icon-btn is-danger"
                    onClick={() => void handleDelete(msg)}
                    disabled={busyId === msg.id}
                    aria-label={`Delete message from ${msg.name}`}
                    title="Delete message"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p className="adm-msg-body">{msg.message}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
