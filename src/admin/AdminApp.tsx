import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Briefcase,
  Check,
  Copy,
  FolderGit2,
  GitBranch,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Terminal,
  UserCircle2,
  Wrench,
  X,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  IDLE_TIMEOUT_MS,
  MAX_SESSION_MS,
  OWNER_EMAIL,
  getSessionStartedAt,
  isGoogleVerified,
  isOwnerEmail,
  signInWithGoogle,
  signOutAdmin,
  verifyAdminAccess,
  watchAuth,
} from "./adminAuth";
import { subscribeToInbox, type AdminActor, type InboxMessage } from "./adminData";
import { describeError } from "./errors";
import { AdminSessionProvider, useAdminSession } from "./session";
import { BioAcademicsSection } from "./sections/BioAcademicsSection";
import { ExperienceSection } from "./sections/ExperienceSection";
import { InboxSection } from "./sections/InboxSection";
import { MediaSection } from "./sections/MediaSection";
import { OverviewSection, type AdminTabId } from "./sections/OverviewSection";
import { ProfileHeroSection } from "./sections/ProfileHeroSection";
import { ProjectsSection } from "./sections/ProjectsSection";
import { SecurityAuditSection, buildRulesWithUid } from "./sections/SecurityAuditSection";
import { SkillsSection } from "./sections/SkillsSection";
import "./admin.css";

type GateState =
  | { kind: "unconfigured" }
  | { kind: "checking" }
  | { kind: "signed-out"; notice?: string }
  | { kind: "unauthorized"; user: User; reason: string }
  | { kind: "authorized"; actor: AdminActor };

const NAV_ITEMS: Array<{
  id: AdminTabId;
  label: string;
  group: "workspace" | "content" | "system";
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", group: "workspace", icon: LayoutDashboard },
  { id: "inbox", label: "Contact Inbox", group: "workspace", icon: Inbox },
  { id: "profile", label: "Profile, Hero & Nav", group: "content", icon: UserCircle2 },
  { id: "media", label: "Media & CV", group: "content", icon: ImageIcon },
  { id: "bio", label: "Bio & Academics", group: "content", icon: BookOpen },
  { id: "skills", label: "Skills & Stack", group: "content", icon: Wrench },
  { id: "projects", label: "Projects", group: "content", icon: FolderGit2 },
  { id: "experience", label: "Experience", group: "content", icon: Briefcase },
  { id: "security", label: "Security & Audit", group: "system", icon: ShieldCheck },
];

export default function AdminApp() {
  const { theme, toggle } = useTheme();
  const [gate, setGate] = useState<GateState>(() =>
    isFirebaseConfigured ? { kind: "checking" } : { kind: "unconfigured" },
  );
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeDirty, setActiveDirty] = useState(false);

  // Add noindex meta while on /admin so search engines never index the panel.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Admin Studio | Jeem Portfolio";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    return () => {
      document.title = prevTitle;
      meta.remove();
    };
  }, []);

  // Tick every second only when cooldown is active.
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const evaluateUser = useCallback(async (user: User | null, notice?: string) => {
    if (!user) {
      setGate({ kind: "signed-out", notice });
      return;
    }

    setGate({ kind: "checking" });

    if (!isGoogleVerified(user) || !isOwnerEmail(user)) {
      await signOutAdmin().catch(() => undefined);
      setGate({
        kind: "signed-out",
        notice: "Access denied. Only the verified portfolio owner account is permitted to enter Admin Studio.",
      });
      return;
    }

    const startedAt = await getSessionStartedAt(user);
    if (Date.now() - startedAt > MAX_SESSION_MS) {
      await signOutAdmin().catch(() => undefined);
      setGate({
        kind: "signed-out",
        notice: "Your 12-hour admin session expired. Please sign in with Google again.",
      });
      return;
    }

    try {
      const allowed = await verifyAdminAccess();
      if (!allowed) {
        setGate({
          kind: "unauthorized",
          user,
          reason:
            "Your Google account is signed in, but Firestore security rules have not granted admin access to your UID yet.",
        });
        return;
      }

      setGate({
        kind: "authorized",
        actor: {
          uid: user.uid,
          email: user.email ?? "admin@unknown",
          displayName: user.displayName ?? user.email ?? "Admin",
          photoURL: user.photoURL,
          sessionStartedAt: startedAt,
        },
      });
    } catch (err) {
      setGate({
        kind: "unauthorized",
        user,
        reason: describeError(err),
      });
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return watchAuth((user) => {
      void evaluateUser(user);
    });
  }, [evaluateUser]);

  const handleSignIn = async () => {
    if (authBusy || cooldownUntil > Date.now()) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      await signInWithGoogle();
      setFailedAttempts(0);
    } catch (err) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= 3) {
        const waitSec = Math.min(60, 5 * 2 ** (nextAttempts - 3));
        setCooldownUntil(Date.now() + waitSec * 1000);
        setNowMs(Date.now());
      }
      setAuthError(describeError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = useCallback(async (notice?: string) => {
    setActiveDirty(false);
    await signOutAdmin().catch(() => undefined);
    setGate({ kind: "signed-out", notice });
  }, []);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000));

  if (gate.kind === "authorized") {
    return (
      <div className="adm-root">
        <AdminSessionProvider actor={gate.actor} setActiveDirty={setActiveDirty}>
          <AuthorizedWorkspace
            actor={gate.actor}
            activeDirty={activeDirty}
            theme={theme}
            toggleTheme={toggle}
            onSignOut={handleSignOut}
          />
        </AdminSessionProvider>
      </div>
    );
  }

  return (
    <div className="adm-root">
      <div className="adm-gate">
        <div className="adm-gate-card">
          <div className="adm-gate-top">
            <div className="adm-brand">
              <Terminal size={18} aria-hidden="true" />
              <span>Jeem Studio</span>
              <span className="adm-brand-badge">
                <Lock size={10} aria-hidden="true" />
                /admin
              </span>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="adm-icon-btn"
                onClick={toggle}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <a href="/" className="adm-btn adm-btn-sm">
                <ArrowLeft size={13} aria-hidden="true" />
                <span>Portfolio</span>
              </a>
            </div>
          </div>

          {gate.kind === "unconfigured" && (
            <>
              <h1>Firebase keys not configured</h1>
              <p>
                Add your <code>VITE_FIREBASE_*</code> credentials to <code>.env.local</code> (and Vercel Environment
                Variables in production), then restart the dev server to unlock the admin studio.
              </p>
            </>
          )}

          {gate.kind === "checking" && (
            <>
              <h1>Verifying credentials...</h1>
              <div className="adm-banner">
                <Loader2 size={16} className="adm-spin" aria-hidden="true" />
                <span>Probing Firestore security rules on Google&apos;s servers...</span>
              </div>
            </>
          )}

          {gate.kind === "signed-out" && (
            <>
              <h1>Protected Admin Studio</h1>
              <p>
                Sign in with your authorised Google account to dynamically edit every section of your portfolio,
                manage your contact inbox, and inspect your immutable audit log.
              </p>

              {gate.notice && (
                <div className="adm-banner is-warn" role="status">
                  <Lock size={16} aria-hidden="true" />
                  <span>{gate.notice}</span>
                </div>
              )}

              {authError && (
                <div className="adm-banner is-danger" role="alert">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="adm-gate-checks">
                <div className="adm-gate-check">
                  <ShieldCheck size={15} aria-hidden="true" />
                  <span>Locked exclusively to owner Google account ({OWNER_EMAIL.replace(/(^.).*(@.*$)/, "$1••••$2")})</span>
                </div>
                <div className="adm-gate-check">
                  <Lock size={15} aria-hidden="true" />
                  <span>Server-enforced email + UID rules &amp; 15-minute idle auto-lock</span>
                </div>
                <div className="adm-gate-check">
                  <KeyRound size={15} aria-hidden="true" />
                  <span>Every edit &amp; upload is validated and logged in an immutable audit log</span>
                </div>
              </div>

              <div className="adm-gate-actions">
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  style={{ flex: 1, minHeight: 44 }}
                  onClick={() => void handleSignIn()}
                  disabled={authBusy || cooldownLeft > 0}
                >
                  {authBusy ? <Loader2 size={15} className="adm-spin" /> : <ShieldCheck size={15} />}
                  <span>
                    {authBusy
                      ? "Opening Google Sign-In..."
                      : cooldownLeft > 0
                        ? `Wait ${cooldownLeft}s before retrying`
                        : "Sign in with Google"}
                  </span>
                </button>
              </div>
            </>
          )}

          {gate.kind === "unauthorized" && (
            <UnauthorizedView
              user={gate.user}
              reason={gate.reason}
              onRetry={() => void evaluateUser(gate.user)}
              onSignOut={() => void handleSignOut()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function UnauthorizedView({
  user,
  reason,
  onRetry,
  onSignOut,
}: {
  user: User;
  reason: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  const copy = async (value: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(value);
      setter(true);
      window.setTimeout(() => setter(false), 2000);
    } catch {
      setter(false);
    }
  };

  return (
    <>
      <h1>Access Denied (Not Yet Allowlisted)</h1>
      <div className="adm-banner is-danger" role="alert">
        <AlertTriangle size={16} aria-hidden="true" />
        <div>
          <strong>Signed in as {user.email || "unknown account"}</strong>
          <div style={{ marginTop: 3 }}>{reason}</div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Your Firebase Auth UID:</div>
        <div className="adm-uid-box">
          <span>{user.uid}</span>
          <button type="button" className="adm-btn adm-btn-sm" onClick={() => void copy(user.uid, setCopiedUid)}>
            {copiedUid ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedUid ? "Copied" : "Copy UID"}</span>
          </button>
        </div>
      </div>

      <ol className="adm-steps-list">
        <li>
          Click <strong>Copy Pre-filled Rules</strong> below (your UID is already inserted into{" "}
          <code>isAdmin()</code>).
        </li>
        <li>
          Open <strong>Firebase Console → Firestore Database → Rules</strong>, paste everything, and click{" "}
          <strong>Publish</strong>.
        </li>
        <li>
          Wait 5 seconds, then click <strong>Re-check Access</strong> below.
        </li>
      </ol>

      <div className="adm-gate-actions">
        <button
          type="button"
          className="adm-btn adm-btn-primary"
          onClick={() => void copy(buildRulesWithUid(user.uid), setCopiedRules)}
        >
          {copiedRules ? <Check size={14} /> : <Copy size={14} />}
          <span>{copiedRules ? "Rules Copied!" : "Copy Pre-filled Rules"}</span>
        </button>
        <button type="button" className="adm-btn" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          <span>Re-check Access</span>
        </button>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={onSignOut}>
          <LogOut size={14} aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );
}

function AuthorizedWorkspace({
  actor,
  activeDirty,
  theme,
  toggleTheme,
  onSignOut,
}: {
  actor: AdminActor;
  activeDirty: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
  onSignOut: (notice?: string) => Promise<void>;
}) {
  const { confirm, toast } = useAdminSession();
  const [tab, setTab] = useState<AdminTabId>("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [idleRemainingSec, setIdleRemainingSec] = useState(Math.floor(IDLE_TIMEOUT_MS / 1000));
  const lastActivityRef = useRef(Date.now());

  // Real-time inbox listener for unread badge + Inbox tab.
  useEffect(() => {
    return subscribeToInbox(
      (data) => setMessages(data),
      (err) => toast({ kind: "error", title: "Inbox sync failed", detail: describeError(err) }),
    );
  }, [toast]);

  // Warn before closing tab if there are unsaved changes.
  useEffect(() => {
    if (!activeDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [activeDirty]);

  // Idle auto-lock + 12-hour max session check.
  useEffect(() => {
    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((evt) => window.addEventListener(evt, bump, { passive: true }));

    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now - actor.sessionStartedAt > MAX_SESSION_MS) {
        void onSignOut("Your 12-hour admin session expired. Please sign in again.");
        return;
      }
      const idleMs = now - lastActivityRef.current;
      const remaining = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - idleMs) / 1000));
      setIdleRemainingSec(remaining);
      if (idleMs >= IDLE_TIMEOUT_MS) {
        void onSignOut("Locked automatically after 15 minutes of inactivity.");
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, bump));
      window.clearInterval(timer);
    };
  }, [actor.sessionStartedAt, onSignOut]);

  const navigate = useCallback(
    async (nextTab: AdminTabId) => {
      if (nextTab === tab) {
        setDrawerOpen(false);
        return;
      }
      if (activeDirty) {
        const ok = await confirm({
          title: "Discard unstaged changes?",
          message: "You have uncommitted edits in this section. Switching sections will discard them.",
          confirmLabel: "Discard & switch",
          danger: true,
        });
        if (!ok) return;
      }
      setTab(nextTab);
      setDrawerOpen(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [tab, activeDirty, confirm],
  );

  const unreadCount = messages.filter((m) => m.status === "unread").length;
  const activeNav = NAV_ITEMS.find((n) => n.id === tab) ?? NAV_ITEMS[0];
  const mins = Math.floor(idleRemainingSec / 60);
  const secs = String(idleRemainingSec % 60).padStart(2, "0");

  return (
    <div className="adm-shell">
      {drawerOpen && (
        <div className="adm-drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      <aside className={`adm-sidebar${drawerOpen ? " is-open" : ""}`} aria-label="Admin sections">
        <div className="adm-sidebar-header">
          <div className="adm-brand">
            <Terminal size={17} aria-hidden="true" />
            <span>Jeem Studio</span>
          </div>
          <button
            type="button"
            className="adm-icon-btn adm-mobile-menu-btn"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          >
            <X size={15} />
          </button>
        </div>

        {(["workspace", "content", "system"] as const).map((group) => (
          <div key={group} className="adm-nav-group">
            <span className="adm-nav-label">
              {group === "workspace" ? "Workspace" : group === "content" ? "Portfolio Sections" : "Security"}
            </span>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`adm-nav-item${tab === item.id ? " is-active" : ""}`}
                  onClick={() => void navigate(item.id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.id === "inbox" && unreadCount > 0 && (
                    <span className="adm-nav-badge">{unreadCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        <div className="adm-sidebar-footer">
          <div className="adm-user-card">
            {actor.photoURL ? (
              <img src={actor.photoURL} alt="" className="adm-user-avatar" referrerPolicy="no-referrer" />
            ) : (
              <div className="adm-user-avatar" aria-hidden="true">
                {actor.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="adm-user-meta">
              <strong>{actor.displayName}</strong>
              <span>{actor.email}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <a href="/" className="adm-btn adm-btn-sm" style={{ flex: 1 }}>
              <ArrowLeft size={13} aria-hidden="true" />
              <span>Site</span>
            </a>
            <button
              type="button"
              className="adm-btn adm-btn-sm adm-btn-danger-outline"
              style={{ flex: 1 }}
              onClick={() => void onSignOut("Signed out cleanly.")}
            >
              <LogOut size={13} aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="adm-main-wrap">
        <header className="adm-topbar">
          <div className="adm-topbar-left">
            <button
              type="button"
              className="adm-icon-btn adm-mobile-menu-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={16} />
            </button>

            <div className="adm-crumb">
              <GitBranch size={13} aria-hidden="true" />
              <span>main</span>
              <span>/</span>
              <strong>{activeNav.label}</strong>
              {activeDirty && <span className="adm-pill is-warn">modified</span>}
            </div>
          </div>

          <div className="adm-topbar-right">
            <span
              className={`adm-pill ${idleRemainingSec < 120 ? "is-warn" : ""}`}
              title="Auto-locks after 15 minutes of inactivity"
            >
              <Lock size={11} aria-hidden="true" />
              <span>
                {mins}:{secs}
              </span>
            </span>

            <button
              type="button"
              className="adm-icon-btn"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        <main className="adm-content">
          {tab === "overview" && (
            <OverviewSection unreadCount={unreadCount} onNavigate={(next) => void navigate(next)} />
          )}
          {tab === "profile" && <ProfileHeroSection />}
          {tab === "media" && <MediaSection />}
          {tab === "bio" && <BioAcademicsSection />}
          {tab === "skills" && <SkillsSection />}
          {tab === "projects" && <ProjectsSection />}
          {tab === "experience" && <ExperienceSection />}
          {tab === "inbox" && <InboxSection messages={messages} />}
          {tab === "security" && <SecurityAuditSection idleRemainingSec={idleRemainingSec} />}
        </main>
      </div>
    </div>
  );
}
