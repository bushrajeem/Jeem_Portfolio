import rawData from "./portfolioData.json";

/**
 * Portfolio domain types and local fallback defaults.
 * At runtime, PortfolioProvider syncs live updates from Firestore and falls back
 * seamlessly to these defaults before Firestore loads or if a field is omitted.
 */

export type ProfileData = {
  name: string;
  shortName: string;
  role: string;
  roleLines: string[];
  location: string;
  email: string;
  github: string;
  githubHandle: string;
  linkedin: string;
  resume: string;
  portrait: string;
  footerPortrait?: string;
  year: number;
  seeking: string;
};

export type AcademicsData = {
  degree: string;
  degreeShort: string;
  university: string;
  universityShort: string;
  standing: string;
  cgpa: string;
  scale: string;
  period: string;
};

export type HeroData = {
  titleLines: string[];
  focus: string;
};

export type BioLeadPart = {
  text: string;
  strong?: boolean;
};

export type BioData = {
  lead: BioLeadPart[];
};

export type NavLink = {
  label: string;
  href: string;
};

export type SkillGroup = {
  id: string;
  order?: number;
  visible?: boolean;
  title: string;
  note: string;
  items: string[];
};

export type ProjectLink = {
  label: string;
  href: string;
};

export type ArchitectureMode = {
  id: string;
  label: string;
  input: string;
  router: { title: string; caption: string };
  targets: { title: string; caption: string }[];
  activeTarget: number;
  explanation: string;
};

export type Project = {
  id: string;
  order?: number;
  visible?: boolean;
  name: string;
  tagline: string;
  category: string;
  summary: string;
  stack: string[];
  links: ProjectLink[];
  /** Real snippet shown in the preview window (file tree / code from the repo). */
  preview: { address: string; lines: string[]; tone: string };
  /** Text shown on the paper sheet inside the folder. */
  paper: { label: string; headline: [string, string]; caption: string };
  outcome: string;
  description: string;
  highlights: string[];
  architecture?: ArchitectureMode[];
};

export type JourneyStop = {
  id: string;
  order?: number;
  visible?: boolean;
  date: string;
  current?: boolean;
  title: string;
  place: string;
  placeNote?: string;
  description: string;
  offset: "low" | "high";
};

export type MilestoneItem = {
  title: string;
  detail: string;
};

export type MilestoneGroup = {
  id: string;
  order?: number;
  visible?: boolean;
  group: string;
  items: MilestoneItem[];
};

export type PortfolioData = {
  profile: ProfileData;
  academics: AcademicsData;
  hero: HeroData;
  bio: BioData;
  navLinks: NavLink[];
  skills: SkillGroup[];
  projects: Project[];
  journey: JourneyStop[];
  milestones: MilestoneGroup[];
  heroCode: string;
};

export const profile: ProfileData = rawData.profile;
export const academics: AcademicsData = rawData.academics;
export const hero: HeroData = rawData.hero;
export const bio: BioData = rawData.bio;
export const navLinks: NavLink[] = rawData.navLinks;
export const skills: SkillGroup[] = rawData.skills;
export const projects: Project[] = rawData.projects.map((project) => ({
  ...project,
  paper: {
    ...project.paper,
    headline: [project.paper.headline[0] ?? "", project.paper.headline[1] ?? ""],
  },
}));
export const journey: JourneyStop[] = rawData.journey.map((stop) => ({
  ...stop,
  offset: stop.offset === "high" ? "high" : "low",
}));
export const milestones: MilestoneGroup[] = rawData.milestones;

function toJsKey(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9]+/g, "");
  return cleaned && /^[a-zA-Z]/.test(cleaned) ? cleaned : JSON.stringify(label);
}

/** Generates the faint WebGL hero code backdrop from live portfolio data. */
export function buildHeroCode(
  data: Pick<PortfolioData, "profile" | "academics" | "projects" | "skills" | "milestones">,
): string {
  const varName =
    data.profile.shortName.toLowerCase().replace(/[^a-z0-9_]/g, "") || "portfolio";
  const featuredProjects = data.projects
    .slice(0, 3)
    .map((p) => `    ${toJsKey(p.name)}: ${JSON.stringify(p.tagline)}`)
    .join(",\n");

  const skillLines = data.skills
    .map((group) => `    ${toJsKey(group.id)}: ${JSON.stringify(group.items.slice(0, 5))}`)
    .join(",\n");

  const topAchievements = (data.milestones[0]?.items ?? [])
    .slice(0, 2)
    .map((item) => item.title);

  const cgpaNum = Number.parseFloat(data.academics.cgpa);
  const cgpaLiteral = Number.isFinite(cgpaNum)
    ? data.academics.cgpa
    : JSON.stringify(data.academics.cgpa);

  return `const ${varName} = {
  name: ${JSON.stringify(data.profile.name)},
  role: ${JSON.stringify(data.profile.role)},
  location: ${JSON.stringify(data.profile.location)},
  education: {
    degree: ${JSON.stringify(data.academics.degree)},
    university: ${JSON.stringify(data.academics.university)},
    standing: ${JSON.stringify(data.academics.standing)},
    cgpa: ${cgpaLiteral}
  },
  projects: {
${featuredProjects}
  },
  skills: {
${skillLines}
  },
  achievements: ${JSON.stringify(topAchievements)},
  email: ${JSON.stringify(data.profile.email)},
  github: ${JSON.stringify(data.profile.github)},
  linkedin: ${JSON.stringify(data.profile.linkedin)}
};

export default function Portfolio() {
  return <main>
    <header><h1>{${varName}.name}</h1><p>{${varName}.role}</p></header>
    <section><h2>Projects</h2>
      {Object.entries(${varName}.projects).map(([name, detail]) =>
        <article key={name}><h3>{name}</h3><p>{detail}</p></article>)}
    </section>
    <footer><a href={"mailto:" + ${varName}.email}>Let's talk.</a></footer>
  </main>;
}`;
}

export const heroCode: string = buildHeroCode({
  profile,
  academics,
  projects,
  skills,
  milestones,
});

export const defaultPortfolioData: PortfolioData = {
  profile,
  academics,
  hero,
  bio,
  navLinks,
  skills,
  projects,
  journey,
  milestones,
  heroCode,
};
