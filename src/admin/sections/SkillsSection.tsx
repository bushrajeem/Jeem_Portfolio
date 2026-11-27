import { useCallback } from "react";
import { Plus } from "lucide-react";
import type { SkillGroup } from "../../data/portfolio";
import { CollectionItemHeader, EditorFrame, Field, TagEditor } from "../components/AdminUI";
import { useAdminSession } from "../session";
import { useCollectionEditor } from "../useEditors";
import { createChecker, uniqueSlug } from "../validation";

export function SkillsSection() {
  const { confirm } = useAdminSession();

  const validateItem = useCallback((item: SkillGroup) => {
    const c = createChecker();
    c.required("Title", item.title, 80);
    c.optional("Note", item.note, 200);
    c.list("Skill items", item.items, { min: 1, max: 30, itemMax: 48 });
    return c.issues;
  }, []);

  const titleOf = useCallback((item: SkillGroup) => item.title, []);
  const editor = useCollectionEditor("skills", { validateItem, titleOf });

  const handleAdd = () => {
    const id = uniqueSlug(
      "skill-group",
      editor.rows.map((r) => r.item.id),
    );
    editor.addItem({
      id,
      visible: true,
      title: "New Skill Group",
      note: "Short description of this group",
      items: ["Skill 1"],
    });
  };

  const handleRemove = async (rowKey: string, title: string) => {
    const ok = await confirm({
      title: `Remove "${title || "skill group"}"?`,
      message: "This removes the skill group from your draft. It won't be deleted from Firestore until you click Commit live.",
      confirmLabel: "Remove group",
      danger: true,
    });
    if (ok) editor.removeItem(rowKey);
  };

  return (
    <EditorFrame
      title="Skills & Tech Stack"
      description="Manage the skill columns displayed in the Tech Stack section. Reorder, hide, or add skill tags freely."
      state={editor}
      extraActions={
        <button type="button" className="adm-btn" onClick={handleAdd} disabled={editor.status !== "ready"}>
          <Plus size={14} aria-hidden="true" />
          <span>Add Skill Group</span>
        </button>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {editor.rows.map((row, idx) => {
          const item = row.item;
          const visible = item.visible !== false;
          return (
            <div key={row.key} className={`adm-card${visible ? "" : " is-hidden-item"}`}>
              <CollectionItemHeader
                index={idx}
                total={editor.rows.length}
                title={item.title}
                id={item.id}
                visible={visible}
                onIdChange={(id) => editor.setId(row.key, id)}
                onToggleVisible={() => editor.setVisible(row.key, !visible)}
                onMoveUp={() => editor.moveItem(row.key, -1)}
                onMoveDown={() => editor.moveItem(row.key, 1)}
                onRemove={() => void handleRemove(row.key, item.title)}
                canRemove={editor.rows.length > 1}
              />

              <div className="adm-grid-2">
                <Field label="Group Title">
                  <input
                    className="adm-input"
                    value={item.title}
                    onChange={(e) => editor.updateItem(row.key, { title: e.target.value })}
                  />
                </Field>
                <Field label="Short Note">
                  <input
                    className="adm-input"
                    value={item.note}
                    onChange={(e) => editor.updateItem(row.key, { note: e.target.value })}
                  />
                </Field>
                <Field label="Skills" hint="Press Enter or comma to add chips" span2>
                  <TagEditor
                    items={item.items}
                    onChange={(items) => editor.updateItem(row.key, { items })}
                    placeholder="e.g. TypeScript, PyTorch, Docker..."
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
