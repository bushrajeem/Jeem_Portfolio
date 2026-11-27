import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { HeroData, ProfileData } from "../../data/portfolio";
import type { NavigationDoc } from "../adminData";
import { EditorFrame, Field } from "../components/AdminUI";
import { useSingletonEditor } from "../useEditors";
import { createChecker } from "../validation";

type SubTab = "profile" | "hero" | "navigation";

export function ProfileHeroSection() {
  const [tab, setTab] = useState<SubTab>("profile");

  return (
    <>
      <div className="adm-tabs" role="tablist" aria-label="Identity and hero sub-sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "profile"}
          className={`adm-tab${tab === "profile" ? " is-active" : ""}`}
          onClick={() => setTab("profile")}
        >
          Profile &amp; Links
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "hero"}
          className={`adm-tab${tab === "hero" ? " is-active" : ""}`}
          onClick={() => setTab("hero")}
        >
          Hero Banner
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "navigation"}
          className={`adm-tab${tab === "navigation" ? " is-active" : ""}`}
          onClick={() => setTab("navigation")}
        >
          Navigation Links
        </button>
      </div>

      {tab === "profile" && <ProfileEditor />}
      {tab === "hero" && <HeroEditor />}
      {tab === "navigation" && <NavigationEditor />}
    </>
  );
}

function ProfileEditor() {
  const validate = useCallback((v: ProfileData) => {
    const c = createChecker();
    c.required("Full name", v.name, 100);
    c.required("Short name", v.shortName, 30);
    c.required("Role", v.role, 120);
    c.list("Role lines", v.roleLines, { min: 1, max: 3, itemMax: 60 });
    c.required("Location", v.location, 80);
    c.email("Email", v.email);
    c.href("GitHub URL", v.github);
    c.required("GitHub handle", v.githubHandle, 60);
    c.href("LinkedIn URL", v.linkedin);
    c.href("Resume PDF path/URL", v.resume);
    c.image("Portrait path/URL", v.portrait);
    if (v.footerPortrait) c.image("Footer portrait path/URL", v.footerPortrait);
    c.check(Number.isInteger(v.year) && v.year >= 2020 && v.year <= 2100, "Year must be between 2020 and 2100.");
    c.required("Seeking statement", v.seeking, 220);
    return c.issues;
  }, []);

  const editor = useSingletonEditor("profile", validate);
  const v = editor.value;

  return (
    <EditorFrame
      title="Profile & Social Links"
      description="Controls your name, role, contact email, social links, portrait image, and resume PDF across the header, hero, contact section, and footer."
      state={editor}
    >
      {v && (
        <div className="adm-card">
          <div className="adm-grid-2">
            <Field label="Full Name">
              <input className="adm-input" value={v.name} onChange={(e) => editor.update({ name: e.target.value })} />
            </Field>
            <Field label="Short Name" hint="Shown in Header wordmark, Bio greeting & Footer crowd">
              <input className="adm-input" value={v.shortName} onChange={(e) => editor.update({ shortName: e.target.value })} />
            </Field>
            <Field label="Role Title" hint="Used in browser tab & background code">
              <input className="adm-input" value={v.role} onChange={(e) => editor.update({ role: e.target.value })} />
            </Field>
            <Field label="Copyright Year">
              <input
                type="number"
                className="adm-input adm-mono"
                value={v.year}
                onChange={(e) => editor.update({ year: Number.parseInt(e.target.value, 10) || new Date().getFullYear() })}
              />
            </Field>
            <Field label="Role Line 1" hint="Top stacked line in Biography & Footer">
              <input
                className="adm-input"
                value={v.roleLines[0] ?? ""}
                onChange={(e) => editor.update({ roleLines: [e.target.value, v.roleLines[1] ?? ""] })}
              />
            </Field>
            <Field label="Role Line 2" hint="Second stacked line">
              <input
                className="adm-input"
                value={v.roleLines[1] ?? ""}
                onChange={(e) => editor.update({ roleLines: [v.roleLines[0] ?? "", e.target.value] })}
              />
            </Field>
            <Field label="Location">
              <input className="adm-input" value={v.location} onChange={(e) => editor.update({ location: e.target.value })} />
            </Field>
            <Field label="Contact Email">
              <input type="email" className="adm-input" value={v.email} onChange={(e) => editor.update({ email: e.target.value })} />
            </Field>
            <Field label="GitHub Profile URL">
              <input className="adm-input adm-mono" value={v.github} onChange={(e) => editor.update({ github: e.target.value })} />
            </Field>
            <Field label="GitHub Handle">
              <input className="adm-input adm-mono" value={v.githubHandle} onChange={(e) => editor.update({ githubHandle: e.target.value })} />
            </Field>
            <Field label="LinkedIn Profile URL">
              <input className="adm-input adm-mono" value={v.linkedin} onChange={(e) => editor.update({ linkedin: e.target.value })} />
            </Field>
            <Field label="Resume PDF Path or https:// URL" hint="Default: /Taslima_Bushra_Islam_Jeem_CV.pdf">
              <input className="adm-input adm-mono" value={v.resume} onChange={(e) => editor.update({ resume: e.target.value })} />
            </Field>
            <Field label="Portrait Image Path or https:// URL" hint="Default: /jeem-portrait.jpg" span2>
              <input className="adm-input adm-mono" value={v.portrait} onChange={(e) => editor.update({ portrait: e.target.value })} />
            </Field>
            <Field label="Seeking Statement" hint='Shown in Contact: "Currently seeking ..."' span2>
              <textarea
                className="adm-textarea"
                rows={2}
                value={v.seeking}
                onChange={(e) => editor.update({ seeking: e.target.value })}
              />
            </Field>
          </div>
        </div>
      )}
    </EditorFrame>
  );
}

function HeroEditor() {
  const validate = useCallback((v: HeroData) => {
    const c = createChecker();
    c.list("Display headline lines", v.titleLines, { min: 2, max: 2, itemMax: 24 });
    c.required("Terminal focus line", v.focus, 80);
    return c.issues;
  }, []);

  const editor = useSingletonEditor("hero", validate);
  const v = editor.value;

  return (
    <EditorFrame
      title="Hero Banner"
      description="Edits the giant 3D flip-in display headline (2 lines) and the blinking terminal focus tagline at the bottom-right of the hero."
      state={editor}
    >
      {v && (
        <div className="adm-card">
          <div className="adm-grid-2">
            <Field label="Display Line 1" hint="Short uppercase word works best (e.g. SOFTWARE)">
              <input
                className="adm-input"
                value={v.titleLines[0] ?? ""}
                onChange={(e) => editor.update({ titleLines: [e.target.value, v.titleLines[1] ?? ""] })}
              />
            </Field>
            <Field label="Display Line 2" hint="Second big display word (e.g. ENGINEER)">
              <input
                className="adm-input"
                value={v.titleLines[1] ?? ""}
                onChange={(e) => editor.update({ titleLines: [v.titleLines[0] ?? "", e.target.value] })}
              />
            </Field>
            <Field label="Terminal Focus Text" hint="Displayed inside {{ ... }} with blinking cursor" span2>
              <input
                className="adm-input adm-mono"
                value={v.focus}
                onChange={(e) => editor.update({ focus: e.target.value })}
              />
            </Field>
          </div>

          <div className="adm-preview">
            <span className="adm-preview-label">Live Hero Typography Preview</span>
            <div style={{ textAlign: "center", fontWeight: 800, fontSize: "clamp(26px, 4vw, 42px)", lineHeight: 0.95, letterSpacing: "-0.035em" }}>
              <div>&lt; {v.titleLines[0] || "LINE 1"}</div>
              <div>{v.titleLines[1] || "LINE 2"} /&gt;</div>
            </div>
            <div className="adm-mono" style={{ textAlign: "right", fontSize: 13, color: "var(--sc-ink-soft)" }}>
              {"{{ "}
              {v.focus || "/FOCUS"}
              {" | }}"}
            </div>
          </div>
        </div>
      )}
    </EditorFrame>
  );
}

function NavigationEditor() {
  const validate = useCallback((v: NavigationDoc) => {
    const c = createChecker();
    c.check(v.links.length >= 1 && v.links.length <= 8, "Keep between 1 and 8 navigation links.");
    v.links.forEach((link, idx) => {
      c.required(`Link #${idx + 1} label`, link.label, 32);
      c.href(`Link #${idx + 1} target`, link.href);
    });
    return c.issues;
  }, []);

  const editor = useSingletonEditor("navigation", validate);
  const v = editor.value;

  const updateLink = (idx: number, patch: { label?: string; href?: string }) => {
    if (!v) return;
    const next = v.links.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    editor.update({ links: next });
  };

  const moveLink = (idx: number, delta: -1 | 1) => {
    if (!v) return;
    const target = idx + delta;
    if (target < 0 || target >= v.links.length) return;
    const next = [...v.links];
    [next[idx], next[target]] = [next[target], next[idx]];
    editor.update({ links: next });
  };

  return (
    <EditorFrame
      title="Navigation Links"
      description="Controls the links inside the slide-out navigation menu and the footer Explore list."
      state={editor}
      extraActions={
        v && (
          <button
            type="button"
            className="adm-btn"
            onClick={() => editor.update({ links: [...v.links, { label: "New Link", href: "#about" }] })}
            disabled={v.links.length >= 8}
          >
            <Plus size={14} aria-hidden="true" />
            <span>Add Link</span>
          </button>
        )
      }
    >
      {v && (
        <div className="adm-card">
          <div style={{ display: "grid", gap: 10 }}>
            {v.links.map((link, idx) => (
              <div key={idx} className="adm-list-row" style={{ flexWrap: "wrap" }}>
                <input
                  className="adm-input"
                  style={{ flex: "1 1 160px" }}
                  value={link.label}
                  onChange={(e) => updateLink(idx, { label: e.target.value })}
                  placeholder="Label (e.g. Projects)"
                  aria-label={`Navigation link ${idx + 1} label`}
                />
                <input
                  className="adm-input adm-mono"
                  style={{ flex: "1 1 200px" }}
                  value={link.href}
                  onChange={(e) => updateLink(idx, { href: e.target.value })}
                  placeholder="#projects or https://..."
                  aria-label={`Navigation link ${idx + 1} URL`}
                />
                <button
                  type="button"
                  className="adm-icon-btn"
                  onClick={() => moveLink(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Move up"
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="adm-icon-btn"
                  onClick={() => moveLink(idx, 1)}
                  disabled={idx === v.links.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="adm-icon-btn is-danger"
                  onClick={() => editor.update({ links: v.links.filter((_, i) => i !== idx) })}
                  disabled={v.links.length <= 1}
                  aria-label="Delete link"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </EditorFrame>
  );
}
