import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { ArchitectureMode, Project } from "../../data/portfolio";
import { CollectionItemHeader, EditorFrame, Field, TagEditor } from "../components/AdminUI";
import { useAdminSession } from "../session";
import { useCollectionEditor } from "../useEditors";
import { createChecker, slugify, uniqueSlug } from "../validation";

const TONE_OPTIONS = [
  { id: "image-adflow", label: "Slate", color: "#d1d2cf" },
  { id: "image-briq", label: "Terracotta", color: "#ddd0c8" },
  { id: "image-ml", label: "Lavender", color: "#d5d1e0" },
  { id: "image-mind", label: "Sage", color: "#c7cdc7" },
  { id: "image-chat", label: "Mist", color: "#cfd5dc" },
  { id: "image-kanban", label: "Sand", color: "#d9d6c9" },
] as const;

export function ProjectsSection() {
  const { confirm } = useAdminSession();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const validateItem = useCallback((p: Project) => {
    const c = createChecker();
    c.required("Name", p.name, 80);
    c.required("Tagline", p.tagline, 80);
    c.required("Category", p.category, 100);
    c.required("Summary", p.summary, 400);
    c.required("Outcome", p.outcome, 240);
    c.required("Description", p.description, 2000);
    c.list("Tech stack", p.stack, { min: 1, max: 20, itemMax: 40 });
    c.list("Highlights", p.highlights, { min: 1, max: 10, itemMax: 240 });
    c.required("Folder label", p.paper.label, 48);
    c.required("Folder headline line 1", p.paper.headline[0], 40);
    c.optional("Folder headline line 2", p.paper.headline[1], 40);
    c.required("Folder caption", p.paper.caption, 48);
    c.required("Preview window address", p.preview.address, 120);
    c.list("Preview code lines", p.preview.lines, { min: 1, max: 24, itemMax: 120, allowEmpty: true });
    p.links.forEach((link, i) => {
      c.required(`Link #${i + 1} label`, link.label, 32);
      c.href(`Link #${i + 1} URL`, link.href);
    });
    if (p.architecture) {
      c.check(p.architecture.length <= 2, "Architecture walkthrough supports up to 2 modes.");
      p.architecture.forEach((mode, i) => {
        c.required(`Architecture mode #${i + 1} label`, mode.label, 40);
        c.required(`Architecture mode #${i + 1} input`, mode.input, 80);
        c.required(`Architecture mode #${i + 1} router title`, mode.router.title, 60);
        c.check(mode.targets.length === 2, `Architecture mode #${i + 1} needs exactly 2 targets.`);
      });
    }
    return c.issues;
  }, []);

  const titleOf = useCallback((p: Project) => p.name, []);
  const editor = useCollectionEditor("projects", { validateItem, titleOf });

  const handleAdd = () => {
    const id = uniqueSlug(
      "new-project",
      editor.rows.map((r) => r.item.id),
    );
    const key = editor.addItem({
      id,
      visible: true,
      name: "New Project",
      tagline: "Short project tagline",
      category: "Category · Focus",
      summary: "One or two sentences summarizing what this project does.",
      stack: ["React", "TypeScript"],
      links: [{ label: "Source", href: "https://github.com/bushrajeem" }],
      preview: {
        address: "github.com/bushrajeem/new-project",
        tone: "image-adflow",
        lines: ["src/", "├── App.tsx", "└── main.tsx"],
      },
      paper: {
        label: "React · TypeScript",
        headline: ["Built for", "real users."],
        caption: "Project overview",
      },
      outcome: "Key result or takeaway from building this project.",
      description: "Detailed explanation of how the project is architected and implemented.",
      highlights: ["Highlight 1: key technical achievement."],
    });
    setExpandedKey(key);
  };

  const handleRemove = async (rowKey: string, name: string) => {
    const ok = await confirm({
      title: `Remove project "${name || "Untitled"}"?`,
      message: "This removes the project from your draft. Commit live to delete it permanently from Firestore.",
      confirmLabel: "Remove project",
      danger: true,
    });
    if (ok) {
      if (expandedKey === rowKey) setExpandedKey(null);
      editor.removeItem(rowKey);
    }
  };

  return (
    <EditorFrame
      title="Featured Projects"
      description="Create, edit, reorder, hide, or delete interactive project folders. Click any project card to expand all fields."
      state={editor}
      extraActions={
        <button type="button" className="adm-btn" onClick={handleAdd} disabled={editor.status !== "ready"}>
          <Plus size={14} aria-hidden="true" />
          <span>Add Project</span>
        </button>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        {editor.rows.map((row, idx) => {
          const p = row.item;
          const visible = p.visible !== false;
          const isOpen = expandedKey === row.key;

          const updateArchitecture = (next: ArchitectureMode[] | undefined) => {
            editor.updateItem(row.key, { architecture: next });
          };

          return (
            <div key={row.key} className={`adm-card${visible ? "" : " is-hidden-item"}`}>
              <CollectionItemHeader
                index={idx}
                total={editor.rows.length}
                title={p.name}
                id={p.id}
                visible={visible}
                onIdChange={(id) => editor.setId(row.key, id)}
                onToggleVisible={() => editor.setVisible(row.key, !visible)}
                onMoveUp={() => editor.moveItem(row.key, -1)}
                onMoveDown={() => editor.moveItem(row.key, 1)}
                onRemove={() => void handleRemove(row.key, p.name)}
                canRemove={editor.rows.length > 1}
                badge={
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm adm-btn-ghost"
                    onClick={() => setExpandedKey(isOpen ? null : row.key)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>{isOpen ? "Collapse" : "Edit Details"}</span>
                  </button>
                }
              />

              {!isOpen && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13, color: "var(--sc-ink-soft)" }}>
                  <span>{p.tagline}</span>
                  <span>·</span>
                  <span className="adm-mono" style={{ fontSize: 12 }}>
                    {p.stack.slice(0, 5).join(", ")}
                    {p.stack.length > 5 ? ` +${p.stack.length - 5}` : ""}
                  </span>
                </div>
              )}

              {isOpen && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div className="adm-grid-2">
                    <Field label="Project Name">
                      <input
                        className="adm-input"
                        value={p.name}
                        onChange={(e) => editor.updateItem(row.key, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Tagline" hint="Shown under the folder card">
                      <input
                        className="adm-input"
                        value={p.tagline}
                        onChange={(e) => editor.updateItem(row.key, { tagline: e.target.value })}
                      />
                    </Field>
                    <Field label="Category" span2>
                      <input
                        className="adm-input"
                        value={p.category}
                        onChange={(e) => editor.updateItem(row.key, { category: e.target.value })}
                      />
                    </Field>
                    <Field label="Summary" span2>
                      <textarea
                        className="adm-textarea"
                        rows={2}
                        value={p.summary}
                        onChange={(e) => editor.updateItem(row.key, { summary: e.target.value })}
                      />
                    </Field>
                    <Field label="Outcome / Key Result" span2>
                      <input
                        className="adm-input"
                        value={p.outcome}
                        onChange={(e) => editor.updateItem(row.key, { outcome: e.target.value })}
                      />
                    </Field>
                    <Field label="Detailed Description" span2>
                      <textarea
                        className="adm-textarea"
                        rows={4}
                        value={p.description}
                        onChange={(e) => editor.updateItem(row.key, { description: e.target.value })}
                      />
                    </Field>
                    <Field label="Tech Stack" hint="Enter or comma to add" span2>
                      <TagEditor
                        items={p.stack}
                        onChange={(stack) => editor.updateItem(row.key, { stack })}
                        placeholder="React, Node.js, Firebase..."
                      />
                    </Field>
                  </div>

                  {/* Links */}
                  <div className="adm-sub-panel">
                    <div className="adm-card-head">
                      <strong style={{ fontSize: 13 }}>Project Links</strong>
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm"
                        onClick={() =>
                          editor.updateItem(row.key, {
                            links: [...p.links, { label: "Live app", href: "https://" }],
                          })
                        }
                      >
                        <Plus size={12} />
                        <span>Add Link</span>
                      </button>
                    </div>
                    {p.links.map((link, lIdx) => (
                      <div key={lIdx} className="adm-list-row" style={{ flexWrap: "wrap" }}>
                        <input
                          className="adm-input"
                          style={{ flex: "0 1 160px" }}
                          value={link.label}
                          onChange={(e) => {
                            const next = p.links.map((item, i) => (i === lIdx ? { ...item, label: e.target.value } : item));
                            editor.updateItem(row.key, { links: next });
                          }}
                          placeholder="Label (Live app / Source)"
                        />
                        <input
                          className="adm-input adm-mono"
                          style={{ flex: "1 1 220px" }}
                          value={link.href}
                          onChange={(e) => {
                            const next = p.links.map((item, i) => (i === lIdx ? { ...item, href: e.target.value } : item));
                            editor.updateItem(row.key, { links: next });
                          }}
                          placeholder="https://..."
                        />
                        <button
                          type="button"
                          className="adm-icon-btn is-danger"
                          onClick={() => editor.updateItem(row.key, { links: p.links.filter((_, i) => i !== lIdx) })}
                          aria-label="Remove link"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Highlights */}
                  <div className="adm-sub-panel">
                    <div className="adm-card-head">
                      <strong style={{ fontSize: 13 }}>Highlights (Bullet List)</strong>
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm"
                        onClick={() => editor.updateItem(row.key, { highlights: [...p.highlights, ""] })}
                      >
                        <Plus size={12} />
                        <span>Add Bullet</span>
                      </button>
                    </div>
                    {p.highlights.map((hl, hIdx) => (
                      <div key={hIdx} className="adm-list-row">
                        <input
                          className="adm-input"
                          value={hl}
                          onChange={(e) => {
                            const next = p.highlights.map((item, i) => (i === hIdx ? e.target.value : item));
                            editor.updateItem(row.key, { highlights: next });
                          }}
                          placeholder="Key highlight..."
                        />
                        <button
                          type="button"
                          className="adm-icon-btn is-danger"
                          onClick={() =>
                            editor.updateItem(row.key, { highlights: p.highlights.filter((_, i) => i !== hIdx) })
                          }
                          disabled={p.highlights.length <= 1}
                          aria-label="Remove highlight"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Folder Paper & Preview Window */}
                  <div className="adm-sub-panel">
                    <strong style={{ fontSize: 13 }}>Folder Sheet &amp; Code Preview Window</strong>
                    <div className="adm-grid-2">
                      <Field label="Folder Top Label" hint="e.g. Socket.IO · MongoDB">
                        <input
                          className="adm-input"
                          value={p.paper.label}
                          onChange={(e) => editor.updateItem(row.key, { paper: { ...p.paper, label: e.target.value } })}
                        />
                      </Field>
                      <Field label="Folder Bottom Caption">
                        <input
                          className="adm-input"
                          value={p.paper.caption}
                          onChange={(e) => editor.updateItem(row.key, { paper: { ...p.paper, caption: e.target.value } })}
                        />
                      </Field>
                      <Field label="Folder Headline Line 1">
                        <input
                          className="adm-input"
                          value={p.paper.headline[0]}
                          onChange={(e) =>
                            editor.updateItem(row.key, {
                              paper: { ...p.paper, headline: [e.target.value, p.paper.headline[1]] },
                            })
                          }
                        />
                      </Field>
                      <Field label="Folder Headline Line 2">
                        <input
                          className="adm-input"
                          value={p.paper.headline[1]}
                          onChange={(e) =>
                            editor.updateItem(row.key, {
                              paper: { ...p.paper, headline: [p.paper.headline[0], e.target.value] },
                            })
                          }
                        />
                      </Field>
                      <Field label="Preview Window Address Bar" span2>
                        <input
                          className="adm-input adm-mono"
                          value={p.preview.address}
                          onChange={(e) =>
                            editor.updateItem(row.key, { preview: { ...p.preview, address: e.target.value } })
                          }
                        />
                      </Field>
                      <Field label="Preview Background Tone" span2>
                        <div className="adm-tone-row">
                          {TONE_OPTIONS.map((tone) => (
                            <button
                              key={tone.id}
                              type="button"
                              className={`adm-tone-chip${p.preview.tone === tone.id ? " is-active" : ""}`}
                              onClick={() =>
                                editor.updateItem(row.key, { preview: { ...p.preview, tone: tone.id } })
                              }
                            >
                              <span className="adm-tone-swatch" style={{ background: tone.color }} />
                              <span>{tone.label}</span>
                            </button>
                          ))}
                        </div>
                      </Field>
                      <Field label="Preview Code / Tree Lines" hint="One line per row" span2>
                        <textarea
                          className="adm-textarea adm-mono"
                          rows={6}
                          value={p.preview.lines.join("\n")}
                          onChange={(e) =>
                            editor.updateItem(row.key, {
                              preview: { ...p.preview, lines: e.target.value.split("\n") },
                            })
                          }
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Optional Architecture Walkthrough */}
                  <div className="adm-sub-panel">
                    <div className="adm-card-head">
                      <div>
                        <strong style={{ fontSize: 13 }}>Architecture Walkthrough (Optional)</strong>
                        <div style={{ fontSize: 12, color: "var(--sc-ink-soft)" }}>
                          Interactive two-branch diagram shown inside the project drawer (up to 2 modes).
                        </div>
                      </div>
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm"
                        disabled={(p.architecture?.length ?? 0) >= 2}
                        onClick={() => {
                          const existing = p.architecture ?? [];
                          const nextMode: ArchitectureMode = {
                            id: existing.length === 0 ? "push" : "heartbeat",
                            label: existing.length === 0 ? "Flow 1" : "Flow 2",
                            input: "Client triggers event",
                            router: { title: "Backend Server", caption: "API / Event channel" },
                            targets: [
                              { title: "Target A", caption: "Primary consumer" },
                              { title: "Target B", caption: "Secondary consumer" },
                            ],
                            activeTarget: existing.length === 0 ? 0 : 1,
                            explanation: "Explain what happens along the active branch.",
                          };
                          updateArchitecture([...existing, nextMode]);
                        }}
                      >
                        <Plus size={12} />
                        <span>Add Mode</span>
                      </button>
                    </div>

                    {(p.architecture ?? []).map((mode, mIdx) => {
                      const patchMode = (patch: Partial<ArchitectureMode>) => {
                        const list = (p.architecture ?? []).map((item, i) => (i === mIdx ? { ...item, ...patch } : item));
                        updateArchitecture(list);
                      };
                      return (
                        <div
                          key={`${mode.id}-${mIdx}`}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            border: "1px solid var(--line)",
                            background: "var(--sc-surface)",
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          <div className="adm-card-head">
                            <span className="adm-pill">Mode #{mIdx + 1}</span>
                            <button
                              type="button"
                              className="adm-btn adm-btn-sm adm-btn-danger-outline"
                              onClick={() => {
                                const remaining = (p.architecture ?? []).filter((_, i) => i !== mIdx);
                                updateArchitecture(remaining.length > 0 ? remaining : undefined);
                              }}
                            >
                              <Trash2 size={12} />
                              <span>Remove</span>
                            </button>
                          </div>

                          <div className="adm-grid-2">
                            <Field label="Button Label">
                              <input
                                className="adm-input"
                                value={mode.label}
                                onChange={(e) => patchMode({ label: e.target.value, id: slugify(e.target.value) })}
                              />
                            </Field>
                            <Field label="Input Event">
                              <input
                                className="adm-input"
                                value={mode.input}
                                onChange={(e) => patchMode({ input: e.target.value })}
                              />
                            </Field>
                            <Field label="Router Node Title">
                              <input
                                className="adm-input"
                                value={mode.router.title}
                                onChange={(e) => patchMode({ router: { ...mode.router, title: e.target.value } })}
                              />
                            </Field>
                            <Field label="Router Node Caption">
                              <input
                                className="adm-input"
                                value={mode.router.caption}
                                onChange={(e) => patchMode({ router: { ...mode.router, caption: e.target.value } })}
                              />
                            </Field>
                            {[0, 1].map((tIdx) => (
                              <div key={tIdx} className="adm-grid-2 adm-span-2">
                                <Field label={`Target ${tIdx + 1} Title`}>
                                  <input
                                    className="adm-input"
                                    value={mode.targets[tIdx]?.title ?? ""}
                                    onChange={(e) => {
                                      const nextTargets = [0, 1].map((i) => ({
                                        title: i === tIdx ? e.target.value : mode.targets[i]?.title ?? "",
                                        caption: mode.targets[i]?.caption ?? "",
                                      }));
                                      patchMode({ targets: nextTargets });
                                    }}
                                  />
                                </Field>
                                <Field label={`Target ${tIdx + 1} Caption`}>
                                  <input
                                    className="adm-input"
                                    value={mode.targets[tIdx]?.caption ?? ""}
                                    onChange={(e) => {
                                      const nextTargets = [0, 1].map((i) => ({
                                        title: mode.targets[i]?.title ?? "",
                                        caption: i === tIdx ? e.target.value : mode.targets[i]?.caption ?? "",
                                      }));
                                      patchMode({ targets: nextTargets });
                                    }}
                                  />
                                </Field>
                              </div>
                            ))}
                            <Field label="Active Highlighted Target">
                              <select
                                className="adm-select"
                                value={mode.activeTarget}
                                onChange={(e) => patchMode({ activeTarget: Number(e.target.value) })}
                              >
                                <option value={0}>Target 1 ({mode.targets[0]?.title || "Left"})</option>
                                <option value={1}>Target 2 ({mode.targets[1]?.title || "Right"})</option>
                              </select>
                            </Field>
                            <Field label="Explanation">
                              <input
                                className="adm-input"
                                value={mode.explanation}
                                onChange={(e) => patchMode({ explanation: e.target.value })}
                              />
                            </Field>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </EditorFrame>
  );
}
