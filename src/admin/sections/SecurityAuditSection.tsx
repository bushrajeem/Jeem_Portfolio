import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Lock, ShieldCheck, ShieldAlert, Terminal } from "lucide-react";
import { subscribeToAudit, type AuditEntry } from "../adminData";
import { IDLE_TIMEOUT_MS, MAX_SESSION_MS } from "../adminAuth";
import { describeError } from "../errors";
import { useAdminSession } from "../session";

export function buildRulesWithUid(uid: string): string {
  return `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.uid in ['${uid}']
        && request.auth.token.email_verified == true
        && request.auth.token.firebase.sign_in_provider == 'google.com';
    }

    function validItemId(itemId) {
      return itemId.matches('^[a-z0-9][a-z0-9-]{0,59}$');
    }

    function stampedNow() {
      return request.resource.data.updatedAt == request.time;
    }

    function validCollectionItem(itemId) {
      return isAdmin()
        && validItemId(itemId)
        && stampedNow()
        && request.resource.data.order is int
        && request.resource.data.order >= 0
        && request.resource.data.order <= 1000
        && request.resource.data.visible is bool
        && request.resource.data.size() <= 30;
    }

    match /portfolio/{docId} {
      allow read: if true;
      allow create, update: if isAdmin()
        && docId in ['profile', 'academics', 'hero', 'bio', 'navigation']
        && stampedNow()
        && request.resource.data.size() <= 30;
      allow delete: if false;
    }

    match /skills/{itemId} {
      allow read: if true;
      allow create, update: if validCollectionItem(itemId);
      allow delete: if isAdmin();
    }

    match /projects/{itemId} {
      allow read: if true;
      allow create, update: if validCollectionItem(itemId);
      allow delete: if isAdmin();
    }

    match /journey/{itemId} {
      allow read: if true;
      allow create, update: if validCollectionItem(itemId);
      allow delete: if isAdmin();
    }

    match /milestones/{itemId} {
      allow read: if true;
      allow create, update: if validCollectionItem(itemId);
      allow delete: if isAdmin();
    }

    match /contactMessages/{messageId} {
      allow create: if request.resource.data.keys().hasOnly([
          'name', 'email', 'message', 'status', 'createdAt'
        ])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 120
        && request.resource.data.email is string
        && request.resource.data.email.size() > 3
        && request.resource.data.email.size() <= 254
        && request.resource.data.message is string
        && request.resource.data.message.size() > 0
        && request.resource.data.message.size() <= 5000
        && request.resource.data.status == 'unread'
        && request.resource.data.createdAt == request.time;

      allow read, delete: if isAdmin();
      allow update: if isAdmin()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
        && request.resource.data.status in ['read', 'unread'];
    }

    match /auditLog/{entryId} {
      allow read: if isAdmin();
      allow create: if isAdmin()
        && request.resource.data.keys().hasOnly(['action', 'section', 'uid', 'email', 'at'])
        && request.resource.data.keys().hasAll(['action', 'section', 'uid', 'email', 'at'])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.at == request.time
        && request.resource.data.action is string
        && request.resource.data.action.size() <= 200
        && request.resource.data.section is string
        && request.resource.data.section.size() <= 40
        && request.resource.data.email is string
        && request.resource.data.email.size() <= 254;
      allow update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;
}

export function SecurityAuditSection({ idleRemainingSec }: { idleRemainingSec: number }) {
  const { actor, toast } = useAdminSession();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  const appCheckEnabled = Boolean(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim());

  useEffect(() => {
    return subscribeToAudit(
      60,
      (data) => setEntries(data),
      (err) => toast({ kind: "error", title: "Could not read audit log", detail: describeError(err) }),
    );
  }, [toast]);

  const copyText = async (text: string, onDone: (v: boolean) => void, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onDone(true);
      window.setTimeout(() => onDone(false), 2000);
      toast({ kind: "info", title: `${label} copied` });
    } catch {
      toast({ kind: "error", title: `Could not copy ${label}` });
    }
  };

  const mins = Math.floor(idleRemainingSec / 60);
  const secs = String(idleRemainingSec % 60).padStart(2, "0");

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h1>Security &amp; Audit Log</h1>
          <p>
            Defense-in-depth architecture built so that even if someone inspects your source code or steals your public
            Firebase API key, they cannot write a single byte to your portfolio.
          </p>
        </div>
      </div>

      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-title">
              <ShieldCheck size={16} aria-hidden="true" />
              <h2>Active Session Telemetry</h2>
            </div>
            <span className="adm-pill is-ok">verified admin</span>
          </div>

          <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
            <div>
              <div style={{ color: "var(--sc-ink-soft)", fontSize: 11.5 }}>Authenticated Admin UID</div>
              <div className="adm-uid-box" style={{ marginTop: 4 }}>
                <span>{actor.uid}</span>
                <button
                  type="button"
                  className="adm-btn adm-btn-sm"
                  onClick={() => void copyText(actor.uid, setCopiedUid, "Admin UID")}
                >
                  {copiedUid ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedUid ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div className="adm-grid-2">
              <div className="adm-sub-panel">
                <span style={{ fontSize: 11.5, color: "var(--sc-ink-soft)" }}>Idle Auto-Lock</span>
                <strong className="adm-mono">
                  {mins}:{secs} / {IDLE_TIMEOUT_MS / 60000}m
                </strong>
              </div>
              <div className="adm-sub-panel">
                <span style={{ fontSize: 11.5, color: "var(--sc-ink-soft)" }}>Session Persistence</span>
                <strong className="adm-mono">Tab-only ({MAX_SESSION_MS / 3600000}h max)</strong>
              </div>
            </div>

            <div className={`adm-banner ${appCheckEnabled ? "is-ok" : "is-warn"}`}>
              {appCheckEnabled ? <Lock size={15} /> : <ShieldAlert size={15} />}
              <div>
                <strong>Firebase App Check: {appCheckEnabled ? "Active" : "Optional (Not set)"}</strong>
                <div style={{ marginTop: 2 }}>
                  {appCheckEnabled
                    ? "reCAPTCHA v3 tokens are attached to Firestore requests."
                    : "Add VITE_FIREBASE_APPCHECK_SITE_KEY in .env.local + Vercel to block automated bot spam on your contact form."}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-title">
              <KeyRound size={16} aria-hidden="true" />
              <h2>7 Security Layers Protecting You</h2>
            </div>
          </div>
          <ol className="adm-steps-list">
            <li>
              <strong>Server-side UID allowlist:</strong> Google&apos;s servers check <code>request.auth.uid</code>,{" "}
              <code>email_verified</code>, and <code>google.com</code> provider before allowing any write.
            </li>
            <li>
              <strong>Zero-trust client check:</strong> Admin UI access is only granted after a live server-verified
              Firestore probe succeeds.
            </li>
            <li>
              <strong>Tab-scoped session + 15m idle lock:</strong> Closing the tab signs you out automatically; inactivity
              locks the panel.
            </li>
            <li>
              <strong>XSS &amp; URL sanitization:</strong> Every link and image URL is validated against{" "}
              <code>javascript:</code> and <code>data:</code> injection on both write and render.
            </li>
            <li>
              <strong>Append-only audit trail:</strong> Nobody (not even admin) can edit or delete <code>auditLog</code>{" "}
              entries in Firestore.
            </li>
            <li>
              <strong>Stealth code-split bundle:</strong> Public visitors never download admin code, and{" "}
              <code>noindex</code> blocks search engines.
            </li>
            <li>
              <strong>HTTP security headers:</strong> <code>vercel.json</code> enforces clickjacking, MIME-sniffing, and
              referrer protections.
            </li>
          </ol>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <div className="adm-card-title">
            <Terminal size={16} aria-hidden="true" />
            <h2>Firestore Security Rules (Pre-filled with your UID)</h2>
          </div>
          <button
            type="button"
            className="adm-btn adm-btn-sm adm-btn-primary"
            onClick={() => void copyText(buildRulesWithUid(actor.uid), setCopiedRules, "Firestore rules")}
          >
            {copiedRules ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedRules ? "Copied Rules" : "Copy Rules"}</span>
          </button>
        </div>
        <pre className="adm-code-block">{buildRulesWithUid(actor.uid)}</pre>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <div className="adm-card-title">
            <ShieldCheck size={16} aria-hidden="true" />
            <h2>Immutable Audit Log ({entries.length})</h2>
          </div>
          <span className="adm-pill">append-only</span>
        </div>

        {entries.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--sc-ink-soft)" }}>
            No entries recorded yet. Every save, seed, or message deletion is automatically logged here.
          </p>
        ) : (
          <div>
            {entries.map((entry) => (
              <div key={entry.id} className="adm-audit-row">
                <span className="adm-pill">{entry.section || "admin"}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-mono" style={{ fontSize: 12.5 }}>
                    {entry.action}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--sc-ink-soft)" }}>{entry.email}</div>
                </div>
                <span className="adm-mono" style={{ fontSize: 11.5, color: "var(--sc-ink-soft)" }}>
                  {entry.at ? entry.at.toLocaleString() : "just now"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
