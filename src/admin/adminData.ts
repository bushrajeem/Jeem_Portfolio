import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";
import {
  defaultPortfolioData,
  type AcademicsData,
  type BioData,
  type HeroData,
  type JourneyStop,
  type MilestoneGroup,
  type NavLink,
  type ProfileData,
  type Project,
  type SkillGroup,
} from "../data/portfolio";
import { getFirestoreDb } from "../lib/firebase";
import {
  COLLECTIONS,
  normalizeAcademics,
  normalizeBio,
  normalizeHero,
  normalizeJourneyStop,
  normalizeMilestoneGroup,
  normalizeNavLinks,
  normalizeProfile,
  normalizeProject,
  normalizeSkillGroup,
  sortByOrder,
} from "../lib/firestore";

export type AdminActor = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  sessionStartedAt: number;
};

export type SingletonKey = "profile" | "academics" | "hero" | "bio" | "navigation";
export type CollectionKey = "skills" | "projects" | "journey" | "milestones";

export const SINGLETON_KEYS: SingletonKey[] = ["profile", "academics", "hero", "bio", "navigation"];
export const COLLECTION_KEYS: CollectionKey[] = ["skills", "projects", "journey", "milestones"];

export type NavigationDoc = { links: NavLink[] };

export type SingletonMap = {
  profile: ProfileData;
  academics: AcademicsData;
  hero: HeroData;
  bio: BioData;
  navigation: NavigationDoc;
};

export type CollectionMap = {
  skills: SkillGroup;
  projects: Project;
  journey: JourneyStop;
  milestones: MilestoneGroup;
};

const singletonNormalizers: { [K in SingletonKey]: (raw: Record<string, unknown>) => SingletonMap[K] } = {
  profile: normalizeProfile,
  academics: normalizeAcademics,
  hero: normalizeHero,
  bio: normalizeBio,
  navigation: (raw) => ({ links: normalizeNavLinks(raw) }),
};

const collectionNormalizers: {
  [K in CollectionKey]: (id: string, raw: Record<string, unknown>) => CollectionMap[K] | null;
} = {
  skills: normalizeSkillGroup,
  projects: normalizeProject,
  journey: normalizeJourneyStop,
  milestones: normalizeMilestoneGroup,
};

function singletonDefault<K extends SingletonKey>(key: K): SingletonMap[K] {
  const defaults: SingletonMap = {
    profile: defaultPortfolioData.profile,
    academics: defaultPortfolioData.academics,
    hero: defaultPortfolioData.hero,
    bio: defaultPortfolioData.bio,
    navigation: { links: defaultPortfolioData.navLinks },
  };
  return structuredClone(defaults[key]);
}

function collectionDefault<K extends CollectionKey>(key: K): CollectionMap[K][] {
  const defaults: { [P in CollectionKey]: CollectionMap[P][] } = {
    skills: defaultPortfolioData.skills,
    projects: defaultPortfolioData.projects,
    journey: defaultPortfolioData.journey,
    milestones: defaultPortfolioData.milestones,
  };
  const list: CollectionMap[K][] = structuredClone(defaults[key]);
  return list.map((item) => ({ ...item, visible: true }));
}

/** Firestore rejects `undefined`, so strip it (recursively) before writing. */
function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => stripUndefined(entry));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) out[key] = stripUndefined(entry);
    }
    return out;
  }
  return value;
}

function toPayload(value: object, skip: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (skip.includes(key) || entry === undefined) continue;
    out[key] = stripUndefined(entry);
  }
  return out;
}

function queueAudit(batch: WriteBatch, db: Firestore, actor: AdminActor, action: string, section: string) {
  batch.set(doc(collection(db, COLLECTIONS.auditLog)), {
    action: action.slice(0, 200),
    section: section.slice(0, 40),
    uid: actor.uid,
    email: actor.email.slice(0, 254),
    at: serverTimestamp(),
  });
}

// ───────────────────────── Singletons ─────────────────────────

export async function loadSingleton<K extends SingletonKey>(
  key: K,
): Promise<{ value: SingletonMap[K]; fromDatabase: boolean }> {
  const snap = await getDoc(doc(getFirestoreDb(), COLLECTIONS.portfolio, key));
  if (!snap.exists()) return { value: singletonDefault(key), fromDatabase: false };
  const normalize: (raw: Record<string, unknown>) => SingletonMap[K] = singletonNormalizers[key];
  return { value: normalize(snap.data()), fromDatabase: true };
}

export async function saveSingleton<K extends SingletonKey>(
  key: K,
  value: SingletonMap[K],
  actor: AdminActor,
): Promise<void> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  batch.set(doc(db, COLLECTIONS.portfolio, key), {
    ...toPayload(value),
    updatedAt: serverTimestamp(),
  });
  queueAudit(batch, db, actor, `update ${key}`, key);
  await batch.commit();
}

// ───────────────────────── Collections ─────────────────────────

export async function loadCollection<K extends CollectionKey>(
  key: K,
): Promise<{ items: CollectionMap[K][]; fromDatabase: boolean; loadedIds: string[] }> {
  const snap = await getDocs(collection(getFirestoreDb(), key));
  if (snap.empty) return { items: collectionDefault(key), fromDatabase: false, loadedIds: [] };

  const normalize: (id: string, raw: Record<string, unknown>) => CollectionMap[K] | null =
    collectionNormalizers[key];
  const items = sortByOrder(
    snap.docs
      .map((docSnap) => normalize(docSnap.id, docSnap.data()))
      .filter((item): item is CollectionMap[K] => item !== null),
  );
  // Only track IDs we could read; malformed docs are left untouched on commit.
  return { items, fromDatabase: true, loadedIds: items.map((item) => item.id) };
}

export async function saveCollection<K extends CollectionKey>(
  key: K,
  items: CollectionMap[K][],
  loadedIds: string[],
  actor: AdminActor,
): Promise<string[]> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  const current = new Set(items.map((item) => item.id));

  items.forEach((item, idx) => {
    batch.set(doc(db, key, item.id), {
      ...toPayload(item, ["id", "order", "visible", "updatedAt"]),
      order: idx + 1,
      visible: item.visible !== false,
      updatedAt: serverTimestamp(),
    });
  });

  const removed = loadedIds.filter((id) => !current.has(id));
  removed.forEach((id) => batch.delete(doc(db, key, id)));

  const detail = removed.length > 0 ? `, removed ${removed.join(", ")}` : "";
  queueAudit(batch, db, actor, `commit ${key}: ${items.length} item${items.length === 1 ? "" : "s"}${detail}`, key);
  await batch.commit();
  return items.map((item) => item.id);
}

// ───────────────────────── Snapshot / seeding / backup ─────────────────────────

export type PortfolioSnapshot = {
  singletons: SingletonMap;
  collections: { [K in CollectionKey]: CollectionMap[K][] };
  inDatabase: Record<SingletonKey | CollectionKey, boolean>;
};

export async function loadEverything(): Promise<PortfolioSnapshot> {
  const [profile, academics, hero, bio, navigation, skills, projects, journey, milestones] = await Promise.all([
    loadSingleton("profile"),
    loadSingleton("academics"),
    loadSingleton("hero"),
    loadSingleton("bio"),
    loadSingleton("navigation"),
    loadCollection("skills"),
    loadCollection("projects"),
    loadCollection("journey"),
    loadCollection("milestones"),
  ]);

  return {
    singletons: {
      profile: profile.value,
      academics: academics.value,
      hero: hero.value,
      bio: bio.value,
      navigation: navigation.value,
    },
    collections: {
      skills: skills.items,
      projects: projects.items,
      journey: journey.items,
      milestones: milestones.items,
    },
    inDatabase: {
      profile: profile.fromDatabase,
      academics: academics.fromDatabase,
      hero: hero.fromDatabase,
      bio: bio.fromDatabase,
      navigation: navigation.fromDatabase,
      skills: skills.fromDatabase,
      projects: projects.fromDatabase,
      journey: journey.fromDatabase,
      milestones: milestones.fromDatabase,
    },
  };
}

/** Publishes built-in defaults ONLY for sections that are not in Firestore yet. */
export async function publishMissingSections(snapshot: PortfolioSnapshot, actor: AdminActor): Promise<number> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  const published: string[] = [];

  for (const key of SINGLETON_KEYS) {
    if (snapshot.inDatabase[key]) continue;
    batch.set(doc(db, COLLECTIONS.portfolio, key), {
      ...toPayload(snapshot.singletons[key]),
      updatedAt: serverTimestamp(),
    });
    published.push(key);
  }

  for (const key of COLLECTION_KEYS) {
    if (snapshot.inDatabase[key]) continue;
    const items: Array<{ id: string; visible?: boolean }> = snapshot.collections[key];
    items.forEach((item, idx) => {
      batch.set(doc(db, key, item.id), {
        ...toPayload(item, ["id", "order", "visible", "updatedAt"]),
        order: idx + 1,
        visible: item.visible !== false,
        updatedAt: serverTimestamp(),
      });
    });
    published.push(key);
  }

  if (published.length === 0) return 0;
  queueAudit(batch, db, actor, `publish defaults: ${published.join(", ")}`, "database");
  await batch.commit();
  return published.length;
}

export function buildBackup(snapshot: PortfolioSnapshot): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      singletons: snapshot.singletons,
      collections: snapshot.collections,
    },
    null,
    2,
  );
}

// ───────────────────────── Inbox ─────────────────────────

export type InboxMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: "read" | "unread";
  createdAt: Date | null;
};

export function subscribeToInbox(
  onData: (messages: InboxMessage[]) => void,
  onError: (err: unknown) => void,
): () => void {
  const q = query(collection(getFirestoreDb(), COLLECTIONS.contactMessages), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: typeof data.name === "string" ? data.name : "(no name)",
            email: typeof data.email === "string" ? data.email : "",
            message: typeof data.message === "string" ? data.message : "",
            status: data.status === "read" ? "read" : "unread",
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
          };
        }),
      );
    },
    onError,
  );
}

export async function setMessageStatus(id: string, status: "read" | "unread"): Promise<void> {
  await updateDoc(doc(getFirestoreDb(), COLLECTIONS.contactMessages, id), { status });
}

export async function deleteMessage(message: InboxMessage, actor: AdminActor): Promise<void> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.contactMessages, message.id));
  queueAudit(batch, db, actor, `delete message from ${message.name.slice(0, 60)}`, "inbox");
  await batch.commit();
}

// ───────────────────────── Audit log ─────────────────────────

export type AuditEntry = {
  id: string;
  action: string;
  section: string;
  email: string;
  at: Date | null;
};

export function subscribeToAudit(
  max: number,
  onData: (entries: AuditEntry[]) => void,
  onError: (err: unknown) => void,
): () => void {
  const q = query(collection(getFirestoreDb(), COLLECTIONS.auditLog), orderBy("at", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            action: typeof data.action === "string" ? data.action : "",
            section: typeof data.section === "string" ? data.section : "",
            email: typeof data.email === "string" ? data.email : "",
            at: data.at instanceof Timestamp ? data.at.toDate() : null,
          };
        }),
      );
    },
    onError,
  );
}
