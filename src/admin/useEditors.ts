import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadCollection,
  loadSingleton,
  saveCollection,
  saveSingleton,
  type CollectionKey,
  type CollectionMap,
  type SingletonKey,
  type SingletonMap,
} from "./adminData";
import { describeError } from "./errors";
import { commitTitle, makeId, useAdminSession } from "./session";
import { SLUG_RE } from "./validation";

export type EditorStatus = "loading" | "ready" | "error";

/** Shared shape used by <EditorFrame /> for both editor kinds. */
export interface FrameState {
  status: EditorStatus;
  loadError: string;
  dirty: boolean;
  saving: boolean;
  fromDatabase: boolean;
  issues: string[];
  commit: () => Promise<void>;
  discard: () => void;
  reload: () => void;
}

export interface SingletonEditor<V> extends FrameState {
  value: V | null;
  update: (patch: Partial<V>) => void;
}

export interface CollectionRow<T> {
  key: string;
  item: T;
}

export interface CollectionEditor<T> extends FrameState {
  rows: CollectionRow<T>[];
  updateItem: (key: string, patch: Partial<T>) => void;
  setId: (key: string, id: string) => void;
  setVisible: (key: string, visible: boolean) => void;
  addItem: (item: T) => string;
  removeItem: (key: string) => void;
  moveItem: (key: string, delta: -1 | 1) => void;
}

function useDirtyReporter(dirty: boolean) {
  const { setActiveDirty } = useAdminSession();
  useEffect(() => {
    setActiveDirty(dirty);
  }, [dirty, setActiveDirty]);
  useEffect(() => () => setActiveDirty(false), [setActiveDirty]);
}

function issueSummary(count: number): string {
  return `Commit blocked: ${count} issue${count === 1 ? "" : "s"} to fix`;
}

// ───────────────────────── Singleton documents ─────────────────────────

export function useSingletonEditor<K extends SingletonKey>(
  key: K,
  validate: (value: SingletonMap[K]) => string[],
): SingletonEditor<SingletonMap[K]> {
  const { actor, toast, handleError } = useAdminSession();
  const [status, setStatus] = useState<EditorStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [value, setValue] = useState<SingletonMap[K] | null>(null);
  const [baseline, setBaseline] = useState("");
  const [fromDatabase, setFromDatabase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadSingleton(key)
      .then((res) => {
        if (cancelled) return;
        setValue(res.value);
        setBaseline(JSON.stringify(res.value));
        setFromDatabase(res.fromDatabase);
        setIssues([]);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(describeError(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [key, reloadToken]);

  const dirty = status === "ready" && value !== null && JSON.stringify(value) !== baseline;
  useDirtyReporter(dirty);

  const update = useCallback((patch: Partial<SingletonMap[K]>) => {
    setValue((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const commit = useCallback(async () => {
    if (!value || saving) return;
    const found = validate(value);
    setIssues(found);
    if (found.length > 0) {
      toast({ kind: "error", title: issueSummary(found.length), detail: found[0] });
      return;
    }
    setSaving(true);
    try {
      await saveSingleton(key, value, actor);
      setBaseline(JSON.stringify(value));
      setFromDatabase(true);
      toast({ kind: "success", title: commitTitle(`update ${key}`), detail: "Pushed live — your portfolio updates in real time." });
    } catch (err) {
      handleError(err, `save ${key}`);
    } finally {
      setSaving(false);
    }
  }, [value, saving, validate, toast, key, actor, handleError]);

  const discard = useCallback(() => {
    if (!baseline) return;
    setValue(JSON.parse(baseline) as SingletonMap[K]);
    setIssues([]);
  }, [baseline]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { status, loadError, value, dirty, saving, fromDatabase, issues, update, commit, discard, reload };
}

// ───────────────────────── Collections ─────────────────────────

type CollectionOptions<T> = {
  validateItem: (item: T) => string[];
  validateAll?: (items: T[]) => string[];
  titleOf: (item: T) => string;
};

export function useCollectionEditor<K extends CollectionKey>(
  key: K,
  options: CollectionOptions<CollectionMap[K]>,
): CollectionEditor<CollectionMap[K]> {
  type Item = CollectionMap[K];
  const { actor, toast, handleError } = useAdminSession();
  const [status, setStatus] = useState<EditorStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState<CollectionRow<Item>[]>([]);
  const [loadedIds, setLoadedIds] = useState<string[]>([]);
  const [baseline, setBaseline] = useState("");
  const [fromDatabase, setFromDatabase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadCollection(key)
      .then((res) => {
        if (cancelled) return;
        setRows(res.items.map((item) => ({ key: makeId(), item })));
        setLoadedIds(res.loadedIds);
        setBaseline(JSON.stringify(res.items));
        setFromDatabase(res.fromDatabase);
        setIssues([]);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(describeError(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [key, reloadToken]);

  const items = useMemo(() => rows.map((row) => row.item), [rows]);
  const serialized = useMemo(() => JSON.stringify(items), [items]);
  const dirty = status === "ready" && serialized !== baseline;
  useDirtyReporter(dirty);

  const updateItem = useCallback((rowKey: string, patch: Partial<Item>) => {
    setRows((prev) => prev.map((row) => (row.key === rowKey ? { ...row, item: { ...row.item, ...patch } } : row)));
  }, []);

  const setId = useCallback((rowKey: string, id: string) => {
    setRows((prev) => prev.map((row) => (row.key === rowKey ? { ...row, item: { ...row.item, id } } : row)));
  }, []);

  const setVisible = useCallback((rowKey: string, visible: boolean) => {
    setRows((prev) => prev.map((row) => (row.key === rowKey ? { ...row, item: { ...row.item, visible } } : row)));
  }, []);

  const addItem = useCallback((item: Item) => {
    const rowKey = makeId();
    setRows((prev) => [...prev, { key: rowKey, item }]);
    return rowKey;
  }, []);

  const removeItem = useCallback((rowKey: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== rowKey)));
  }, []);

  const moveItem = useCallback((rowKey: string, delta: -1 | 1) => {
    setRows((prev) => {
      const idx = prev.findIndex((row) => row.key === rowKey);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const { validateItem, validateAll, titleOf } = options;

  const commit = useCallback(async () => {
    if (saving || status !== "ready") return;
    const found: string[] = [];
    if (items.length === 0) found.push("Keep at least one item in this section.");
    if (!items.some((item) => item.visible !== false)) found.push("At least one item must stay visible on the portfolio.");

    const seen = new Set<string>();
    items.forEach((item, idx) => {
      const label = titleOf(item).trim() || `Item ${idx + 1}`;
      if (!SLUG_RE.test(item.id)) {
        found.push(`[${label}] ID must use lowercase letters, numbers and dashes (max 60).`);
      } else if (seen.has(item.id)) {
        found.push(`[${label}] ID "${item.id}" is used more than once.`);
      }
      seen.add(item.id);
      validateItem(item).forEach((msg) => found.push(`[${label}] ${msg}`));
    });
    if (validateAll) found.push(...validateAll(items));

    setIssues(found);
    if (found.length > 0) {
      toast({ kind: "error", title: issueSummary(found.length), detail: found[0] });
      return;
    }

    setSaving(true);
    try {
      const savedIds = await saveCollection(key, items, loadedIds, actor);
      setLoadedIds(savedIds);
      setBaseline(JSON.stringify(items));
      setFromDatabase(true);
      toast({ kind: "success", title: commitTitle(`commit ${key} (${items.length})`), detail: "Pushed live — your portfolio updates in real time." });
    } catch (err) {
      handleError(err, `save ${key}`);
    } finally {
      setSaving(false);
    }
  }, [saving, status, items, titleOf, validateItem, validateAll, toast, key, loadedIds, actor, handleError]);

  const discard = useCallback(() => {
    if (!baseline) return;
    const restored = JSON.parse(baseline) as Item[];
    setRows(restored.map((item) => ({ key: makeId(), item })));
    setIssues([]);
  }, [baseline]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return {
    status,
    loadError,
    rows,
    dirty,
    saving,
    fromDatabase,
    issues,
    updateItem,
    setId,
    setVisible,
    addItem,
    removeItem,
    moveItem,
    commit,
    discard,
    reload,
  };
}
