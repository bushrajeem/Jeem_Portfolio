import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import {
  buildHeroCode,
  defaultPortfolioData,
  type AcademicsData,
  type ArchitectureMode,
  type BioData,
  type BioLeadPart,
  type HeroData,
  type JourneyStop,
  type MilestoneGroup,
  type MilestoneItem,
  type NavLink,
  type PortfolioData,
  type ProfileData,
  type Project,
  type ProjectLink,
  type SkillGroup,
} from "../data/portfolio";
import { db, getFirestoreDb, isFirebaseConfigured } from "./firebase";
import { isValidEmail, safeHref, safeImageSrc, isSafeHref } from "./safeUrl";

export const COLLECTIONS = {
  portfolio: "portfolio",
  skills: "skills",
  projects: "projects",
  journey: "journey",
  milestones: "milestones",
  contactMessages: "contactMessages",
  auditLog: "auditLog",
} as const;

export interface ContactMessageInput {
  name: string;
  email: string;
  message: string;
}

export interface ContactMessageRecord extends ContactMessageInput {
  id: string;
  status: "unread" | "read";
  createdAt: Timestamp | null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asOptionalString(value: unknown, fallback?: string): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((item): item is string => typeof item === "string");
  return cleaned.length > 0 ? cleaned : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asLinks(value: unknown): ProjectLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const obj = asRecord(entry);
      if (typeof obj.label !== "string" || typeof obj.href !== "string") return null;
      if (!isSafeHref(obj.href)) return null;
      return { label: obj.label, href: obj.href.trim() };
    })
    .filter((entry): entry is ProjectLink => entry !== null);
}

export function sortByOrder<T extends { order?: number }>(items: T[]): T[] {
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const orderA = typeof a.item.order === "number" ? a.item.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.item.order === "number" ? b.item.order : Number.MAX_SAFE_INTEGER;
      return orderA === orderB ? a.idx - b.idx : orderA - orderB;
    })
    .map(({ item }) => item);
}

export function normalizeProfile(raw: Record<string, unknown>): ProfileData {
  const d = defaultPortfolioData.profile;
  const email = typeof raw.email === "string" && isValidEmail(raw.email) ? raw.email.trim() : d.email;
  return {
    name: asString(raw.name, d.name),
    shortName: asString(raw.shortName, d.shortName),
    role: asString(raw.role, d.role),
    roleLines: asStringArray(raw.roleLines, d.roleLines),
    location: asString(raw.location, d.location),
    email,
    github: safeHref(raw.github, d.github),
    githubHandle: asString(raw.githubHandle, d.githubHandle),
    linkedin: safeHref(raw.linkedin, d.linkedin),
    resume: safeHref(raw.resume, d.resume),
    portrait: safeImageSrc(raw.portrait, d.portrait),
    year: asNumber(raw.year, d.year),
    seeking: asString(raw.seeking, d.seeking),
  };
}

export function normalizeAcademics(raw: Record<string, unknown>): AcademicsData {
  const d = defaultPortfolioData.academics;
  return {
    degree: asString(raw.degree, d.degree),
    degreeShort: asString(raw.degreeShort, d.degreeShort),
    university: asString(raw.university, d.university),
    universityShort: asString(raw.universityShort, d.universityShort),
    standing: asString(raw.standing, d.standing),
    cgpa: asString(raw.cgpa, d.cgpa),
    scale: asString(raw.scale, d.scale),
    period: asString(raw.period, d.period),
  };
}

export function normalizeHero(raw: Record<string, unknown>): HeroData {
  const d = defaultPortfolioData.hero;
  return {
    // The hero layout is designed for exactly two display lines.
    titleLines: asStringArray(raw.titleLines, d.titleLines).slice(0, 2),
    focus: asString(raw.focus, d.focus),
  };
}

export function normalizeBio(raw: Record<string, unknown>): BioData {
  const d = defaultPortfolioData.bio;
  if (!Array.isArray(raw.lead)) return d;
  const parts: BioLeadPart[] = raw.lead
    .map((entry) => {
      const obj = asRecord(entry);
      if (typeof obj.text !== "string") return null;
      return obj.strong === true ? { text: obj.text, strong: true } : { text: obj.text };
    })
    .filter((entry): entry is BioLeadPart => entry !== null);
  return parts.length > 0 ? { lead: parts } : d;
}

export function normalizeNavLinks(raw: Record<string, unknown>): NavLink[] {
  const d = defaultPortfolioData.navLinks;
  const links = asLinks(raw.links);
  return links.length > 0 ? links : d;
}

export function normalizeSkillGroup(id: string, raw: Record<string, unknown>): SkillGroup | null {
  const title = asOptionalString(raw.title);
  if (!title) return null;
  return {
    id,
    order: typeof raw.order === "number" ? raw.order : undefined,
    visible: raw.visible !== false,
    title,
    note: typeof raw.note === "string" ? raw.note : "",
    items: Array.isArray(raw.items)
      ? raw.items.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function normalizeArchitecture(value: unknown): ArchitectureMode[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const modes: ArchitectureMode[] = value
    .map((entry, idx) => {
      const obj = asRecord(entry);
      const router = asRecord(obj.router);
      const targetsRaw = Array.isArray(obj.targets) ? obj.targets : [];
      const targets = targetsRaw
        .map((t) => {
          const item = asRecord(t);
          if (typeof item.title !== "string") return null;
          return {
            title: item.title,
            caption: typeof item.caption === "string" ? item.caption : "",
          };
        })
        .filter((t): t is { title: string; caption: string } => t !== null)
        // The routing diagram draws exactly two target branches.
        .slice(0, 2);

      if (typeof obj.label !== "string" || targets.length === 0) return null;

      return {
        id: asString(obj.id, `mode-${idx}`),
        label: obj.label,
        input: typeof obj.input === "string" ? obj.input : "",
        router: {
          title: typeof router.title === "string" ? router.title : "",
          caption: typeof router.caption === "string" ? router.caption : "",
        },
        targets,
        activeTarget: Math.min(Math.max(Math.trunc(asNumber(obj.activeTarget, 0)), 0), targets.length - 1),
        explanation: typeof obj.explanation === "string" ? obj.explanation : "",
      };
    })
    .filter((entry): entry is ArchitectureMode => entry !== null)
    .slice(0, 2);

  return modes.length > 0 ? modes : undefined;
}

export function normalizeProject(id: string, raw: Record<string, unknown>): Project | null {
  const name = asOptionalString(raw.name);
  if (!name) return null;

  const previewObj = asRecord(raw.preview);
  const paperObj = asRecord(raw.paper);
  const rawHeadline = Array.isArray(paperObj.headline)
    ? paperObj.headline.filter((line): line is string => typeof line === "string")
    : [];

  return {
    id,
    order: typeof raw.order === "number" ? raw.order : undefined,
    visible: raw.visible !== false,
    name,
    tagline: typeof raw.tagline === "string" ? raw.tagline : "",
    category: typeof raw.category === "string" ? raw.category : "",
    summary: typeof raw.summary === "string" ? raw.summary : "",
    stack: Array.isArray(raw.stack)
      ? raw.stack.filter((item): item is string => typeof item === "string")
      : [],
    links: asLinks(raw.links),
    preview: {
      address: typeof previewObj.address === "string" ? previewObj.address : id,
      tone: asString(previewObj.tone, "image-adflow"),
      lines: Array.isArray(previewObj.lines)
        ? previewObj.lines.filter((line): line is string => typeof line === "string")
        : [],
    },
    paper: {
      label: typeof paperObj.label === "string" ? paperObj.label : "",
      headline: [rawHeadline[0] ?? name, rawHeadline[1] ?? ""],
      caption: typeof paperObj.caption === "string" ? paperObj.caption : "",
    },
    outcome: typeof raw.outcome === "string" ? raw.outcome : "",
    description: typeof raw.description === "string" ? raw.description : "",
    highlights: Array.isArray(raw.highlights)
      ? raw.highlights.filter((item): item is string => typeof item === "string")
      : [],
    architecture: normalizeArchitecture(raw.architecture),
  };
}

export function normalizeJourneyStop(id: string, raw: Record<string, unknown>): JourneyStop | null {
  const title = asOptionalString(raw.title);
  if (!title) return null;

  return {
    id,
    order: typeof raw.order === "number" ? raw.order : undefined,
    visible: raw.visible !== false,
    date: typeof raw.date === "string" ? raw.date : "",
    current: raw.current === true ? true : undefined,
    title,
    place: typeof raw.place === "string" ? raw.place : "",
    placeNote: asOptionalString(raw.placeNote),
    description: typeof raw.description === "string" ? raw.description : "",
    offset: raw.offset === "high" ? "high" : "low",
  };
}

export function normalizeMilestoneGroup(id: string, raw: Record<string, unknown>): MilestoneGroup | null {
  const group = asOptionalString(raw.group);
  if (!group) return null;

  const items: MilestoneItem[] = Array.isArray(raw.items)
    ? raw.items
        .map((entry) => {
          const obj = asRecord(entry);
          if (typeof obj.title !== "string") return null;
          return {
            title: obj.title,
            detail: typeof obj.detail === "string" ? obj.detail : "",
          };
        })
        .filter((entry): entry is MilestoneItem => entry !== null)
    : [];

  return {
    id,
    order: typeof raw.order === "number" ? raw.order : undefined,
    visible: raw.visible !== false,
    group,
    items,
  };
}

/**
 * Subscribes in real time to all portfolio collections in Cloud Firestore.
 * Any missing or empty collection automatically falls back to local defaults so
 * the site renders immediately without layout shift or crashes. Items marked
 * `visible: false` in the admin panel are hidden from visitors.
 */
export function subscribeToPortfolio(
  onUpdate: (data: PortfolioData) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    return () => {};
  }

  let state: Omit<PortfolioData, "heroCode"> = {
    profile: defaultPortfolioData.profile,
    academics: defaultPortfolioData.academics,
    hero: defaultPortfolioData.hero,
    bio: defaultPortfolioData.bio,
    navLinks: defaultPortfolioData.navLinks,
    skills: defaultPortfolioData.skills,
    projects: defaultPortfolioData.projects,
    journey: defaultPortfolioData.journey,
    milestones: defaultPortfolioData.milestones,
  };

  const emit = () => {
    onUpdate({
      ...state,
      heroCode: buildHeroCode(state),
    });
  };

  const handleErr = (error: Error) => {
    onError?.(error);
  };

  const unsubscribers: Unsubscribe[] = [
    onSnapshot(
      collection(db, COLLECTIONS.portfolio),
      (snapshot) => {
        if (snapshot.empty) return;
        const docs = new Map<string, Record<string, unknown>>();
        snapshot.forEach((docSnap) => {
          docs.set(docSnap.id, docSnap.data());
        });

        const profileDoc = docs.get("profile");
        const academicsDoc = docs.get("academics");
        const heroDoc = docs.get("hero");
        const bioDoc = docs.get("bio");
        const navDoc = docs.get("navigation");

        state = {
          ...state,
          profile: profileDoc ? normalizeProfile(profileDoc) : defaultPortfolioData.profile,
          academics: academicsDoc ? normalizeAcademics(academicsDoc) : defaultPortfolioData.academics,
          hero: heroDoc ? normalizeHero(heroDoc) : defaultPortfolioData.hero,
          bio: bioDoc ? normalizeBio(bioDoc) : defaultPortfolioData.bio,
          navLinks: navDoc ? normalizeNavLinks(navDoc) : defaultPortfolioData.navLinks,
        };
        emit();
      },
      handleErr,
    ),

    onSnapshot(
      collection(db, COLLECTIONS.skills),
      (snapshot) => {
        if (snapshot.empty) return;
        state = {
          ...state,
          skills: sortByOrder(
            snapshot.docs
              .map((docSnap) => normalizeSkillGroup(docSnap.id, docSnap.data()))
              .filter((item): item is SkillGroup => item !== null && item.visible !== false),
          ),
        };
        emit();
      },
      handleErr,
    ),

    onSnapshot(
      collection(db, COLLECTIONS.projects),
      (snapshot) => {
        if (snapshot.empty) return;
        state = {
          ...state,
          projects: sortByOrder(
            snapshot.docs
              .map((docSnap) => normalizeProject(docSnap.id, docSnap.data()))
              .filter((item): item is Project => item !== null && item.visible !== false),
          ),
        };
        emit();
      },
      handleErr,
    ),

    onSnapshot(
      collection(db, COLLECTIONS.journey),
      (snapshot) => {
        if (snapshot.empty) return;
        state = {
          ...state,
          journey: sortByOrder(
            snapshot.docs
              .map((docSnap) => normalizeJourneyStop(docSnap.id, docSnap.data()))
              .filter((item): item is JourneyStop => item !== null && item.visible !== false),
          ),
        };
        emit();
      },
      handleErr,
    ),

    onSnapshot(
      collection(db, COLLECTIONS.milestones),
      (snapshot) => {
        if (snapshot.empty) return;
        state = {
          ...state,
          milestones: sortByOrder(
            snapshot.docs
              .map((docSnap) => normalizeMilestoneGroup(docSnap.id, docSnap.data()))
              .filter((item): item is MilestoneGroup => item !== null && item.visible !== false),
          ),
        };
        emit();
      },
      handleErr,
    ),
  ];

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

/**
 * Saves a portfolio contact form submission into the `contactMessages` collection.
 */
export async function submitContactMessage(input: ContactMessageInput): Promise<string> {
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();

  if (!name || !email || !message) {
    throw new Error("Please fill in your name, email address, and message.");
  }

  if (name.length > 120) {
    throw new Error("Name must be 120 characters or fewer.");
  }

  if (email.length > 254 || !isValidEmail(email)) {
    throw new Error("Please enter a valid email address.");
  }

  if (message.length > 5000) {
    throw new Error("Message must be 5,000 characters or fewer.");
  }

  const database = getFirestoreDb();
  const docRef = await addDoc(collection(database, COLLECTIONS.contactMessages), {
    name,
    email,
    message,
    status: "unread",
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Reads all documents from a Firestore collection with optional query constraints.
 */
export async function getCollectionDocs<T extends DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<Array<T & { id: string }>> {
  const database = getFirestoreDb();
  const colRef = collection(database, collectionName);
  const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as T),
  }));
}

/**
 * Reads a single Firestore document by collection name and document ID.
 */
export async function getDocumentById<T extends DocumentData>(
  collectionName: string,
  id: string,
): Promise<(T & { id: string }) | null> {
  const database = getFirestoreDb();
  const snapshot = await getDoc(doc(database, collectionName, id));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as T),
  };
}
