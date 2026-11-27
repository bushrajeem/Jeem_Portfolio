import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Database,
  Eye,
  EyeOff,
  GitCommitHorizontal,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { FrameState } from "../useEditors";
import { sanitizeSlugInput } from "../validation";

/**
 * Wraps every section editor with:
 * - Section title, description, and Firestore sync badge
 * - Commit (Ctrl/Cmd+S), Discard, and Reload buttons
 * - Loading / error / validation-issues banners
 */
export function EditorFrame({
  title,
  description,
  state,
  commitLabel = "Commit live",
  extraActions,
  children,
}: {
  title: string;
  description: string;
  state: FrameState;
  commitLabel?: string;
  extraActions?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (state.status === "ready" && state.dirty && !state.saving) {
          void state.commit();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state]);

  return (
    <>
      <div className="adm-section-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <h1 style={{ margin: 0 }}>{title}</h1>
            {state.status === "ready" && (
              <span className={`adm-pill ${state.dirty ? "is-warn" : state.fromDatabase ? "is-ok" : ""}`}>
                <span className="adm-dot" aria-hidden="true" />
                {state.dirty ? "unstaged changes" : state.fromDatabase ? "synced with firestore" : "local defaults"}
              </span>
            )}
          </div>
          <p>{description}</p>
        </div>

        <div className="adm-commit-bar">
          {extraActions}
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={state.reload}
            disabled={state.saving || state.status === "loading"}
            title="Reload latest from Firestore"
          >
            <RefreshCw size={14} className={state.status === "loading" ? "adm-spin" : ""} aria-hidden="true" />
            <span>Reload</span>
          </button>
          <button
            type="button"
            className="adm-btn"
            onClick={state.discard}
            disabled={!state.dirty || state.saving}
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Discard</span>
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={() => void state.commit()}
            disabled={state.status !== "ready" || state.saving || (!state.dirty && state.fromDatabase)}
          >
            {state.saving ? (
              <Loader2 size={14} className="adm-spin" aria-hidden="true" />
            ) : (
              <GitCommitHorizontal size={15} aria-hidden="true" />
            )}
            <span>{state.saving ? "Committing..." : state.fromDatabase ? commitLabel : "Publish to Firestore"}</span>
            <span className="adm-kbd">Ctrl+S</span>
          </button>
        </div>
      </div>

      {state.status === "loading" && (
        <div className="adm-banner">
          <Loader2 size={16} className="adm-spin" aria-hidden="true" />
          <span>Loading latest documents from Firestore...</span>
        </div>
      )}

      {state.status === "error" && (
        <div className="adm-banner is-danger" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>Could not load section data</strong>
            <div>{state.loadError}</div>
          </div>
        </div>
      )}

      {state.status === "ready" && !state.fromDatabase && (
        <div className="adm-banner is-warn">
          <Database size={16} aria-hidden="true" />
          <div>
            <strong>Showing built-in defaults</strong> — this section hasn&apos;t been saved to Firestore yet. Click{" "}
            <strong>Publish to Firestore</strong> to save it as a live editable document.
          </div>
        </div>
      )}

      {state.issues.length > 0 && (
        <div className="adm-banner is-danger" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>Fix {state.issues.length} validation issue{state.issues.length === 1 ? "" : "s"} before committing:</strong>
            <ul>
              {state.issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {state.status === "ready" && children}
    </>
  );
}

export function Field({
  label,
  hint,
  span2 = false,
  children,
}: {
  label: string;
  hint?: string;
  span2?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`adm-field${span2 ? " adm-span-2" : ""}`}>
      <span className="adm-field-label">
        <span>{label}</span>
        {hint && <span className="adm-field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Chip/tag list editor for skill items, tech stacks, etc. */
export function TagEditor({
  items,
  onChange,
  placeholder = "Type an item and press Enter...",
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const pieces = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (pieces.length === 0) return;
    const existing = new Set(items);
    const merged = [...items];
    pieces.forEach((p) => {
      if (!existing.has(p)) {
        merged.push(p);
        existing.add(p);
      }
    });
    onChange(merged);
    setDraft("");
  };

  return (
    <div className="adm-tags-wrap">
      {items.map((item, idx) => (
        <span key={`${item}-${idx}`} className="adm-tag">
          <span>{item}</span>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            aria-label={`Remove ${item}`}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <div className="adm-tag-input-row">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addDraft();
            } else if (e.key === "Backspace" && !draft && items.length > 0) {
              onChange(items.slice(0, -1));
            }
          }}
        />
        <button type="button" className="adm-btn adm-btn-sm" onClick={addDraft} disabled={!draft.trim()}>
          <Plus size={12} aria-hidden="true" />
          <span>Add</span>
        </button>
      </div>
    </div>
  );
}

/** Standard header bar for reorderable/hideable collection item cards. */
export function CollectionItemHeader({
  index,
  total,
  title,
  id,
  visible,
  onIdChange,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onRemove,
  canRemove,
  badge,
}: {
  index: number;
  total: number;
  title: string;
  id: string;
  visible: boolean;
  onIdChange: (nextId: string) => void;
  onToggleVisible: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canRemove: boolean;
  badge?: ReactNode;
}) {
  return (
    <div className="adm-card-head">
      <div className="adm-card-title">
        <span className="adm-pill">#{index + 1}</span>
        <h3>{title || "Untitled item"}</h3>
        {!visible && <span className="adm-pill is-warn">hidden</span>}
        {badge}
      </div>

      <div className="adm-card-controls">
        <input
          type="text"
          className="adm-input adm-mono"
          style={{ width: 150, minHeight: 32, padding: "4px 8px", fontSize: 12 }}
          value={id}
          onChange={(e) => onIdChange(sanitizeSlugInput(e.target.value))}
          aria-label="Document ID slug"
          title="Firestore document ID (lowercase letters, numbers, dashes)"
          spellCheck={false}
        />
        <button
          type="button"
          className="adm-icon-btn"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Move up"
          title="Move up"
        >
          <ArrowUp size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="adm-icon-btn"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="Move down"
          title="Move down"
        >
          <ArrowDown size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="adm-icon-btn"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide from public site" : "Show on public site"}
          title={visible ? "Visible on site (click to hide)" : "Hidden from site (click to show)"}
        >
          {visible ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="adm-icon-btn is-danger"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Delete item"
          title={canRemove ? "Delete item" : "Keep at least one item"}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
