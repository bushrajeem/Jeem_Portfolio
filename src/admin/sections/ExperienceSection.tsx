import { useCallback, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { JourneyStop, MilestoneGroup } from "../../data/portfolio";
import { CollectionItemHeader, EditorFrame, Field } from "../components/AdminUI";
import { useAdminSession } from "../session";
import { useCollectionEditor } from "../useEditors";
import { createChecker, uniqueSlug } from "../validation";

export function ExperienceSection() {
  const [tab, setTab] = useState<"journey" | "milestones">("journey");

  return (
    <>
      <div className="adm-tabs" role="tablist" aria-label="Experience and milestones tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "journey"}
          className={`adm-tab${tab === "journey" ? " is-active" : ""}`}
          onClick={() => setTab("journey")}
        >
          Journey Roadmap
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "milestones"}
          className={`adm-tab${tab === "milestones" ? " is-active" : ""}`}
          onClick={() => setTab("milestones")}
        >
          Milestones &amp; Achievements
        </button>
      </div>

      {tab === "journey" ? <JourneyEditor /> : <MilestonesEditor />}
    </>
  );
}

function JourneyEditor() {
  const { confirm } = useAdminSession();

  const validateItem = useCallback((stop: JourneyStop) => {
    const c = createChecker();
    c.required("Date / Label", stop.date, 40);
    c.required("Title", stop.title, 80);
    c.required("Place / Organization", stop.place, 100);
    c.optional("Place Note", stop.placeNote, 120);
    c.required("Description", stop.description, 400);
    return c.issues;
  }, []);

  const titleOf = useCallback((stop: JourneyStop) => stop.title, []);
  const editor = useCollectionEditor("journey", { validateItem, titleOf });

  const handleAdd = () => {
    const id = uniqueSlug(
      "milestone-stop",
      editor.rows.map((r) => r.item.id),
    );
    const nextOffset = editor.rows.length % 2 === 0 ? "low" : "high";
    editor.addItem({
      id,
      visible: true,
      date: "2026",
      title: "New Experience Stop",
      place: "Organization or Institution",
      placeNote: "",
      description: "Describe your role, impact, or achievement.",
      offset: nextOffset,
    });
  };

  const handleRemove = async (rowKey: string, title: string) => {
    const ok = await confirm({
      title: `Remove "${title || "journey stop"}"?`,
      message: "The SVG roadmap curve automatically recalculates for the remaining stops when committed.",
      confirmLabel: "Remove stop",
      danger: true,
    });
    if (ok) editor.removeItem(rowKey);
  };

  return (
    <EditorFrame
      title="Journey Roadmap"
      description="Edits the curved timeline stops in the Experience section. Alternating Low / High offsets gives the winding road visual effect."
      state={editor}
      extraActions={
        <button type="button" className="adm-btn" onClick={handleAdd} disabled={editor.status !== "ready"}>
          <Plus size={14} aria-hidden="true" />
          <span>Add Stop</span>
        </button>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {editor.rows.map((row, idx) => {
          const stop = row.item;
          const visible = stop.visible !== false;
          return (
            <div key={row.key} className={`adm-card${visible ? "" : " is-hidden-item"}`}>
              <CollectionItemHeader
                index={idx}
                total={editor.rows.length}
                title={stop.title}
                id={stop.id}
                visible={visible}
                onIdChange={(id) => editor.setId(row.key, id)}
                onToggleVisible={() => editor.setVisible(row.key, !visible)}
                onMoveUp={() => editor.moveItem(row.key, -1)}
                onMoveDown={() => editor.moveItem(row.key, 1)}
                onRemove={() => void handleRemove(row.key, stop.title)}
                canRemove={editor.rows.length > 1}
                badge={stop.current ? <span className="adm-pill is-ok">Current</span> : undefined}
              />

              <div className="adm-grid-2">
                <Field label="Title">
                  <input
                    className="adm-input"
                    value={stop.title}
                    onChange={(e) => editor.updateItem(row.key, { title: e.target.value })}
                  />
                </Field>
                <Field label="Date / Tag" hint="e.g. 2023 – Present, Leadership, Coursera">
                  <input
                    className="adm-input"
                    value={stop.date}
                    onChange={(e) => editor.updateItem(row.key, { date: e.target.value })}
                  />
                </Field>
                <Field label="Place / Organization">
                  <input
                    className="adm-input"
                    value={stop.place}
                    onChange={(e) => editor.updateItem(row.key, { place: e.target.value })}
                  />
                </Field>
                <Field label="Place Sub-Note" hint="Optional (e.g. CGPA or club acronym)">
                  <input
                    className="adm-input"
                    value={stop.placeNote ?? ""}
                    onChange={(e) => editor.updateItem(row.key, { placeNote: e.target.value || undefined })}
                  />
                </Field>
                <Field label="Vertical Offset on Road">
                  <select
                    className="adm-select"
                    value={stop.offset}
                    onChange={(e) => editor.updateItem(row.key, { offset: e.target.value === "high" ? "high" : "low" })}
                  >
                    <option value="low">Low (top row)</option>
                    <option value="high">High (lower staggered row)</option>
                  </select>
                </Field>
                <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
                  <label className="adm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(stop.current)}
                      onChange={(e) => editor.updateItem(row.key, { current: e.target.checked ? true : undefined })}
                    />
                    <span>Highlight with &quot;Current&quot; badge</span>
                  </label>
                </div>
                <Field label="Description" span2>
                  <textarea
                    className="adm-textarea"
                    rows={2}
                    value={stop.description}
                    onChange={(e) => editor.updateItem(row.key, { description: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          );
        })}
      </div>
    </EditorFrame>
  );
}

function MilestonesEditor() {
  const { confirm } = useAdminSession();

  const validateItem = useCallback((group: MilestoneGroup) => {
    const c = createChecker();
    c.required("Group Heading", group.group, 60);
    c.check(group.items.length >= 1 && group.items.length <= 20, "Keep between 1 and 20 items in a group.");
    group.items.forEach((item, i) => {
      c.required(`Item #${i + 1} title`, item.title, 80);
      c.required(`Item #${i + 1} detail`, item.detail, 200);
    });
    return c.issues;
  }, []);

  const titleOf = useCallback((group: MilestoneGroup) => group.group, []);
  const editor = useCollectionEditor("milestones", { validateItem, titleOf });

  const handleAddGroup = () => {
    const id = uniqueSlug(
      "milestone-group",
      editor.rows.map((r) => r.item.id),
    );
    editor.addItem({
      id,
      visible: true,
      group: "Certifications",
      items: [{ title: "Achievement title", detail: "Short detail or rank" }],
    });
  };

  const handleRemoveGroup = async (rowKey: string, groupName: string) => {
    const ok = await confirm({
      title: `Remove "${groupName || "group"}"?`,
      message: "All entries inside this milestone group will be removed when you commit.",
      confirmLabel: "Remove group",
      danger: true,
    });
    if (ok) editor.removeItem(rowKey);
  };

  return (
    <EditorFrame
      title="Milestones & Achievements"
      description="Controls the grouped lists below the roadmap (Competitions, Volunteering, Languages, etc.)."
      state={editor}
      extraActions={
        <button type="button" className="adm-btn" onClick={handleAddGroup} disabled={editor.status !== "ready"}>
          <Plus size={14} aria-hidden="true" />
          <span>Add Group</span>
        </button>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {editor.rows.map((row, idx) => {
          const group = row.item;
          const visible = group.visible !== false;
          return (
            <div key={row.key} className={`adm-card${visible ? "" : " is-hidden-item"}`}>
              <CollectionItemHeader
                index={idx}
                total={editor.rows.length}
                title={group.group}
                id={group.id}
                visible={visible}
                onIdChange={(id) => editor.setId(row.key, id)}
                onToggleVisible={() => editor.setVisible(row.key, !visible)}
                onMoveUp={() => editor.moveItem(row.key, -1)}
                onMoveDown={() => editor.moveItem(row.key, 1)}
                onRemove={() => void handleRemoveGroup(row.key, group.group)}
                canRemove={editor.rows.length > 1}
              />

              <Field label="Group Heading">
                <input
                  className="adm-input"
                  value={group.group}
                  onChange={(e) => editor.updateItem(row.key, { group: e.target.value })}
                />
              </Field>

              <div className="adm-sub-panel">
                <div className="adm-card-head">
                  <strong style={{ fontSize: 13 }}>Entries ({group.items.length})</strong>
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={() =>
                      editor.updateItem(row.key, {
                        items: [...group.items, { title: "", detail: "" }],
                      })
                    }
                  >
                    <Plus size={12} />
                    <span>Add Entry</span>
                  </button>
                </div>

                {group.items.map((entry, eIdx) => (
                  <div key={eIdx} className="adm-list-row" style={{ flexWrap: "wrap" }}>
                    <input
                      className="adm-input"
                      style={{ flex: "1 1 180px" }}
                      value={entry.title}
                      onChange={(e) => {
                        const next = group.items.map((item, i) => (i === eIdx ? { ...item, title: e.target.value } : item));
                        editor.updateItem(row.key, { items: next });
                      }}
                      placeholder="Title"
                    />
                    <input
                      className="adm-input"
                      style={{ flex: "2 1 260px" }}
                      value={entry.detail}
                      onChange={(e) => {
                        const next = group.items.map((item, i) => (i === eIdx ? { ...item, detail: e.target.value } : item));
                        editor.updateItem(row.key, { items: next });
                      }}
                      placeholder="Detail / description"
                    />
                    <button
                      type="button"
                      className="adm-icon-btn is-danger"
                      onClick={() =>
                        editor.updateItem(row.key, { items: group.items.filter((_, i) => i !== eIdx) })
                      }
                      disabled={group.items.length <= 1}
                      aria-label="Remove entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </EditorFrame>
  );
}
