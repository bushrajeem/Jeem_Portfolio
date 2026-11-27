import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  CloudUpload,
  Database,
  Download,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  COLLECTION_KEYS,
  SINGLETON_KEYS,
  buildBackup,
  loadEverything,
  publishMissingSections,
  subscribeToAudit,
  type AuditEntry,
  type PortfolioSnapshot,
} from "../adminData";
import { describeError } from "../errors";
import { commitTitle, useAdminSession } from "../session";

export type AdminTabId =
  | "overview"
  | "profile"
  | "bio"
  | "skills"
  | "projects"
  | "experience"
  | "inbox"
  | "security";

export function OverviewSection({
  unreadCount,
  onNavigate,
}: {
  unreadCount: number;
  onNavigate: (tab: AdminTabId) => void;
}) {
  const { actor, toast, handleError } = useAdminSession();
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadEverything();
      setSnapshot(data);
    } catch (err) {
      handleError(err, "load overview");
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void refresh();
    return subscribeToAudit(
      8,
      (entries) => setAudit(entries),
      (err) => toast({ kind: "error", title: "Audit log error", detail: describeError(err) }),
    );
  }, [refresh, toast]);

  const allKeys = [...SINGLETON_KEYS, ...COLLECTION_KEYS];
  const syncedCount = snapshot ? allKeys.filter((k) => snapshot.inDatabase[k]).length : 0;
  const missingCount = allKeys.length - syncedCount;

  const handlePublishMissing = async () => {
    if (!snapshot || publishing || missingCount === 0) return;
    setPublishing(true);
    try {
      const published = await publishMissingSections(snapshot, actor);
      toast({
        kind: "success",
        title: commitTitle(`seed ${published} section${published === 1 ? "" : "s"}`),
        detail: "All portfolio defaults are now live in Firestore.",
      });
      await refresh();
    } catch (err) {
      handleError(err, "publish defaults");
    } finally {
      setPublishing(false);
    }
  };

  const handleExportBackup = () => {
    if (!snapshot) return;
    const blob = new Blob([buildBackup(snapshot)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jeem-portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ kind: "info", title: "Backup exported", detail: "Saved a full JSON snapshot of your portfolio." });
  };

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h1>Welcome back, {actor.displayName.split(" ")[0] || "Admin"}.</h1>
          <p>
            Control center for your live portfolio. Every commit writes straight to Firestore and logs to your
            tamper-proof audit trail.
          </p>
        </div>

        <div className="adm-commit-bar">
          <button type="button" className="adm-btn" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "adm-spin" : ""} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button type="button" className="adm-btn" onClick={handleExportBackup} disabled={!snapshot}>
            <Download size={14} aria-hidden="true" />
            <span>Export JSON</span>
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn-primary">
            <span>View Live Site</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      {snapshot && missingCount > 0 && (
        <div className="adm-banner is-warn" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Database size={18} aria-hidden="true" />
            <div>
              <strong>
                {missingCount} of {allKeys.length} sections are still using local fallback defaults.
              </strong>{" "}
              Push them to Firestore in one click so every section lives in your database.
            </div>
          </div>
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={() => void handlePublishMissing()}
            disabled={publishing}
          >
            {publishing ? <Loader2 size={14} className="adm-spin" /> : <CloudUpload size={14} />}
            <span>{publishing ? "Publishing..." : "Publish Missing Defaults"}</span>
          </button>
        </div>
      )}

      <div className="adm-stats">
        <div className="adm-stat">
          <span className="adm-stat-label">Firestore Sync</span>
          <span className="adm-stat-value">
            {syncedCount}/{allKeys.length}
          </span>
          <span className="adm-stat-sub">{missingCount === 0 ? "all sections live" : `${missingCount} on defaults`}</span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-label">Projects</span>
          <span className="adm-stat-value">{snapshot?.collections.projects.length ?? "—"}</span>
          <span className="adm-stat-sub">
            {snapshot ? `${snapshot.collections.projects.filter((p) => p.visible !== false).length} visible` : "loading"}
          </span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-label">Skill Groups</span>
          <span className="adm-stat-value">{snapshot?.collections.skills.length ?? "—"}</span>
          <span className="adm-stat-sub">
            {snapshot
              ? `${snapshot.collections.skills.reduce((sum, g) => sum + g.items.length, 0)} skills total`
              : "loading"}
          </span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-label">Unread Messages</span>
          <span className="adm-stat-value">{unreadCount}</span>
          <span className="adm-stat-sub">contactMessages</span>
        </div>
      </div>

      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-title">
              <Database size={16} aria-hidden="true" />
              <h2>Section Sync Status</h2>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {[
              { label: "Profile, Hero & Navigation", keys: ["profile", "hero", "navigation"] as const, tab: "profile" as AdminTabId },
              { label: "Biography & Academics", keys: ["bio", "academics"] as const, tab: "bio" as AdminTabId },
              { label: "Skills & Tech Stack", keys: ["skills"] as const, tab: "skills" as AdminTabId },
              { label: "Featured Projects", keys: ["projects"] as const, tab: "projects" as AdminTabId },
              { label: "Experience & Milestones", keys: ["journey", "milestones"] as const, tab: "experience" as AdminTabId },
            ].map((row) => {
              const allLive = snapshot ? row.keys.every((k) => snapshot.inDatabase[k]) : false;
              return (
                <div
                  key={row.tab}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "var(--sc-canvas)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{row.label}</div>
                    <div className="adm-mono" style={{ fontSize: 11, color: "var(--sc-ink-soft)" }}>
                      {row.keys.join(" · ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`adm-pill ${allLive ? "is-ok" : "is-warn"}`}>
                      {allLive ? "live" : "default"}
                    </span>
                    <button type="button" className="adm-btn adm-btn-sm" onClick={() => onNavigate(row.tab)}>
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-title">
              <ShieldCheck size={16} aria-hidden="true" />
              <h2>Recent Git-Style Audit Log</h2>
            </div>
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => onNavigate("security")}>
              Full log
            </button>
          </div>

          {audit.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--sc-ink-soft)" }}>
              No commits recorded yet. Your edits will appear here automatically with timestamps.
            </p>
          ) : (
            <div>
              {audit.map((entry) => (
                <div key={entry.id} className="adm-audit-row">
                  <span className="adm-pill">{entry.section || "system"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="adm-mono" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {entry.action}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--sc-ink-soft)" }}>{entry.email}</div>
                  </div>
                  <span className="adm-mono" style={{ fontSize: 11, color: "var(--sc-ink-soft)" }}>
                    {entry.at ? entry.at.toLocaleDateString() : "now"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 6 }}>
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => onNavigate("inbox")}>
              <Mail size={13} aria-hidden="true" />
              <span>Open Inbox ({unreadCount} unread)</span>
            </button>
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => onNavigate("security")}>
              <CheckCircle2 size={13} aria-hidden="true" />
              <span>Security Check</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
