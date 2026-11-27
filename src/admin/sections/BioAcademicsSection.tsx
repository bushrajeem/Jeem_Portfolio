import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, Bold, Plus, Trash2 } from "lucide-react";
import type { AcademicsData, BioData } from "../../data/portfolio";
import { EditorFrame, Field } from "../components/AdminUI";
import { useSingletonEditor } from "../useEditors";
import { createChecker } from "../validation";

export function BioAcademicsSection() {
  const [tab, setTab] = useState<"bio" | "academics">("bio");

  return (
    <>
      <div className="adm-tabs" role="tablist" aria-label="Biography and academics tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "bio"}
          className={`adm-tab${tab === "bio" ? " is-active" : ""}`}
          onClick={() => setTab("bio")}
        >
          Biography Lead
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "academics"}
          className={`adm-tab${tab === "academics" ? " is-active" : ""}`}
          onClick={() => setTab("academics")}
        >
          Academics &amp; CGPA
        </button>
      </div>

      {tab === "bio" ? <BioEditor /> : <AcademicsEditor />}
    </>
  );
}

function BioEditor() {
  const validate = useCallback((v: BioData) => {
    const c = createChecker();
    c.check(v.lead.length >= 1 && v.lead.length <= 16, "Add between 1 and 16 text segments.");
    const fullText = v.lead.map((p) => p.text).join("").trim();
    c.check(fullText.length > 0 && fullText.length <= 600, "Combined bio text must be between 1 and 600 characters.");
    return c.issues;
  }, []);

  const editor = useSingletonEditor("bio", validate);
  const v = editor.value;

  const updateSegment = (idx: number, patch: { text?: string; strong?: boolean }) => {
    if (!v) return;
    const next = v.lead.map((part, i) => {
      if (i !== idx) return part;
      const merged = { ...part, ...patch };
      return merged.strong ? { text: merged.text, strong: true } : { text: merged.text };
    });
    editor.update({ lead: next });
  };

  const moveSegment = (idx: number, delta: -1 | 1) => {
    if (!v) return;
    const target = idx + delta;
    if (target < 0 || target >= v.lead.length) return;
    const next = [...v.lead];
    [next[idx], next[target]] = [next[target], next[idx]];
    editor.update({ lead: next });
  };

  return (
    <EditorFrame
      title="Biography Lead"
      description="Build your highlighted bio statement using normal and bold text segments (spaces are preserved so sentences flow smoothly)."
      state={editor}
      extraActions={
        v && (
          <button
            type="button"
            className="adm-btn"
            onClick={() => editor.update({ lead: [...v.lead, { text: " and more..." }] })}
            disabled={v.lead.length >= 16}
          >
            <Plus size={14} aria-hidden="true" />
            <span>Add Segment</span>
          </button>
        )
      }
    >
      {v && (
        <div className="adm-card">
          <div style={{ display: "grid", gap: 10 }}>
            {v.lead.map((part, idx) => (
              <div key={idx} className="adm-list-row">
                <input
                  className="adm-input"
                  value={part.text}
                  onChange={(e) => updateSegment(idx, { text: e.target.value })}
                  placeholder="Text segment (include leading/trailing space if needed)"
                  aria-label={`Bio segment ${idx + 1}`}
                />
                <button
                  type="button"
                  className={`adm-btn adm-btn-sm${part.strong ? " adm-btn-primary" : ""}`}
                  onClick={() => updateSegment(idx, { strong: !part.strong })}
                  aria-pressed={Boolean(part.strong)}
                  title="Toggle bold highlight"
                >
                  <Bold size={13} aria-hidden="true" />
                  <span>Bold</span>
                </button>
                <button
                  type="button"
                  className="adm-icon-btn"
                  onClick={() => moveSegment(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Move segment up"
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="adm-icon-btn"
                  onClick={() => moveSegment(idx, 1)}
                  disabled={idx === v.lead.length - 1}
                  aria-label="Move segment down"
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="adm-icon-btn is-danger"
                  onClick={() => editor.update({ lead: v.lead.filter((_, i) => i !== idx) })}
                  disabled={v.lead.length <= 1}
                  aria-label="Remove segment"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <div className="adm-preview">
            <span className="adm-preview-label">Live Biography Preview</span>
            <p style={{ margin: 0, fontSize: 20, lineHeight: 1.35, fontWeight: 500 }}>
              {v.lead.map((part, idx) =>
                part.strong ? <strong key={idx}>{part.text}</strong> : <span key={idx}>{part.text}</span>,
              )}
            </p>
          </div>
        </div>
      )}
    </EditorFrame>
  );
}

function AcademicsEditor() {
  const validate = useCallback((v: AcademicsData) => {
    const c = createChecker();
    c.required("Full degree name", v.degree, 120);
    c.required("Short degree label", v.degreeShort, 40);
    c.required("University name", v.university, 120);
    c.required("University short name", v.universityShort, 24);
    c.required("Standing", v.standing, 60);
    c.required("CGPA", v.cgpa, 12);
    c.required("GPA scale", v.scale, 12);
    c.required("Study period", v.period, 40);
    return c.issues;
  }, []);

  const editor = useSingletonEditor("academics", validate);
  const v = editor.value;

  return (
    <EditorFrame
      title="Academics & CGPA"
      description="Updates your university, standing, degree, and CGPA in the Biography section and the Hero background code."
      state={editor}
    >
      {v && (
        <div className="adm-card">
          <div className="adm-grid-2">
            <Field label="University">
              <input className="adm-input" value={v.university} onChange={(e) => editor.update({ university: e.target.value })} />
            </Field>
            <Field label="University Short Name">
              <input
                className="adm-input"
                value={v.universityShort}
                onChange={(e) => editor.update({ universityShort: e.target.value })}
              />
            </Field>
            <Field label="Full Degree Name">
              <input className="adm-input" value={v.degree} onChange={(e) => editor.update({ degree: e.target.value })} />
            </Field>
            <Field label="Short Degree Label" hint="Shown in Biography (e.g. B.Sc. CSE)">
              <input className="adm-input" value={v.degreeShort} onChange={(e) => editor.update({ degreeShort: e.target.value })} />
            </Field>
            <Field label="Current Standing" hint="e.g. 4th-year undergraduate / Graduated">
              <input className="adm-input" value={v.standing} onChange={(e) => editor.update({ standing: e.target.value })} />
            </Field>
            <Field label="Period" hint="e.g. 2023 – Present">
              <input className="adm-input" value={v.period} onChange={(e) => editor.update({ period: e.target.value })} />
            </Field>
            <Field label="CGPA">
              <input className="adm-input adm-mono" value={v.cgpa} onChange={(e) => editor.update({ cgpa: e.target.value })} />
            </Field>
            <Field label="Scale">
              <input className="adm-input adm-mono" value={v.scale} onChange={(e) => editor.update({ scale: e.target.value })} />
            </Field>
          </div>
        </div>
      )}
    </EditorFrame>
  );
}
