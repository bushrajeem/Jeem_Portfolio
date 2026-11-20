import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  FolderOpen,
  Info,
  MonitorPlay,
  Radio,
  Send,
  X,
} from "lucide-react";
import { profile, projects, type ArchitectureMode, type Project } from "../data/portfolio";
import { Reveal, WaveText, ease } from "./ui/Motion";

function ArchitectureExhibit({ modes }: { modes: ArchitectureMode[] }) {
  const [activeId, setActiveId] = useState(modes[0].id);
  const current = modes.find((m) => m.id === activeId) ?? modes[0];

  return (
    <div className="architecture-exhibit" aria-label="Real-time architecture walkthrough">
      <div className="route-switch" role="group" aria-label="Select data flow">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            aria-pressed={current.id === mode.id}
            onClick={() => setActiveId(mode.id)}
          >
            {mode.id === "push" ? <Send size={13} /> : <Activity size={13} />}
            <span>{mode.label}</span>
          </button>
        ))}
      </div>

      <div className="routing-diagram">
        <div className="diagram-input">
          <Radio size={14} />
          <span>{current.input}</span>
        </div>

        <div className="diagram-stem" aria-hidden="true" />

        <div className="router-node">
          <Radio size={16} />
          <div>
            <strong>{current.router.title}</strong>
            <span>{current.router.caption}</span>
          </div>
        </div>

        <svg className="route-lines" viewBox="0 0 320 60" preserveAspectRatio="none" aria-hidden="true">
          <path className="route-line-base" d="M 160 0 C 160 32, 80 28, 80 60" />
          <path className="route-line-base" d="M 160 0 C 160 32, 240 28, 240 60" />
          <path
            className="route-line-active"
            d="M 160 0 C 160 32, 80 28, 80 60"
            style={{ opacity: current.activeTarget === 0 ? 1 : 0 }}
          />
          <path
            className="route-line-active"
            d="M 160 0 C 160 32, 240 28, 240 60"
            style={{ opacity: current.activeTarget === 1 ? 1 : 0 }}
          />
        </svg>

        <div className="engine-columns">
          {current.targets.map((target, idx) => (
            <div
              key={target.title}
              className={`engine-node${current.activeTarget === idx ? " engine-active" : ""}`}
            >
              {idx === 0 ? <MonitorPlay size={15} /> : <Activity size={15} />}
              <strong>{target.title}</strong>
              <span>{target.caption}</span>
            </div>
          ))}
        </div>

        <div className="route-explanation">
          <Info size={14} />
          <p>{current.explanation}</p>
        </div>
      </div>
    </div>
  );
}

function ProjectStudy({ project }: { project: Project }) {
  const primaryHref = project.links[0]?.href ?? profile.github;

  return (
    <motion.article
      key={project.id}
      className="project-study"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease }}
    >
      <a
        href={primaryHref}
        target="_blank"
        rel="noopener noreferrer"
        className="project-image-link"
        aria-label={`Open ${project.name}`}
      >
        <div className={`project-image ${project.preview.tone}`}>
          <div className="preview-window">
            <div className="preview-bar">
              <span className="preview-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="preview-address">{project.preview.address}</span>
            </div>
            <pre className="preview-code">
              {project.preview.lines.map((line, idx) => (
                <span key={idx}>{line || " "}</span>
              ))}
            </pre>
          </div>
          <span className="image-action" aria-hidden="true">
            <ArrowUpRight size={18} />
          </span>
        </div>
      </a>

      <div className="study-content">
        <h3>{project.name}</h3>
        <p className="project-category">{project.category}</p>
        <p className="study-summary">{project.summary}</p>

        <div className="stack-list" aria-label="Tech stack">
          {project.stack.map((tech) => (
            <span key={tech}>{tech}</span>
          ))}
        </div>

        <div className="project-links">
          {project.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link wave-target"
            >
              <WaveText>{link.label}</WaveText>
              <ArrowUpRight size={14} />
            </a>
          ))}
        </div>

        <p className="study-outcome">{project.outcome}</p>

        {project.architecture && (
          <details className="project-details" open>
            <summary>
              <span>Architecture walkthrough</span>
              <ChevronDown size={16} />
            </summary>
            <div className="detail-body">
              <ArchitectureExhibit modes={project.architecture} />
            </div>
          </details>
        )}

        <details className="project-details" open={!project.architecture}>
          <summary>
            <span>Project details</span>
            <ChevronDown size={16} />
          </summary>
          <div className="detail-body">
            <p>{project.description}</p>
            <ul>
              {project.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </motion.article>
  );
}

export function Projects() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedIndex = projects.findIndex((p) => p.id === selectedId);
  const selectedProject = selectedIndex >= 0 ? projects[selectedIndex] : null;

  const openFolder = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const stepProject = (delta: number) => {
    const base = selectedIndex >= 0 ? selectedIndex : 0;
    const next = (base + delta + projects.length) % projects.length;
    setSelectedId(projects[next].id);
  };

  return (
    <section id="projects" className="projects-section wrap" aria-labelledby="projects-heading">
      <Reveal className="section-heading">
        <h2 id="projects-heading">
          Featured
          <br />
          Projects
        </h2>
        <a
          href={profile.github}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link wave-target"
        >
          <WaveText>GitHub</WaveText>
          <ArrowUpRight size={15} />
        </a>
      </Reveal>

      <Reveal delay={0.05}>
        <p className="projects-intro">
          Full-stack web applications and machine learning builds from my repositories. Open a
          folder to inspect architecture, stack, and source.
        </p>
      </Reveal>

      <div className="project-folder-grid">
        {projects.map((project, idx) => {
          const isOpen = selectedId === project.id;
          return (
            <Reveal key={project.id} delay={idx * 0.05}>
              <button
                type="button"
                className="project-folder"
                aria-expanded={isOpen}
                aria-controls="project-details-panel"
                onClick={() => openFolder(project.id)}
              >
                <span className="sr-only">{project.name}</span>

                <span className="folder-scene" aria-hidden="true">
                  <span className="folder-back" />

                  <span className="folder-paper folder-paper-back">
                    <FileCode2 size={14} />
                    <span>Project overview</span>
                    <span className="folder-paper-lines" />
                  </span>

                  <span className="folder-paper folder-paper-preview">
                    <span className="folder-case-preview">
                      <span>{project.paper.label}</span>
                      <strong>
                        {project.paper.headline[0]}
                        <br />
                        {project.paper.headline[1]}
                      </strong>
                      <span>{project.paper.caption}</span>
                    </span>
                    <span>{project.name}</span>
                  </span>

                  <span className="folder-paper folder-paper-front">
                    <FolderOpen size={14} />
                    <span>Details &amp; source</span>
                    <span className="folder-paper-lines" />
                  </span>

                  <span className="folder-front">
                    <span className="folder-front-title">{project.name}</span>
                    <span className="folder-open-icon">
                      <ArrowUpRight size={18} />
                    </span>
                  </span>
                </span>

                <span className="folder-caption">
                  <span>{project.tagline}</span>
                  <span className="folder-caption-action">
                    {isOpen ? "Viewing" : "View project"}
                    <ArrowUpRight size={14} />
                  </span>
                </span>
              </button>
            </Reveal>
          );
        })}
      </div>

      <div
        id="project-details-panel"
        ref={panelRef}
        className="project-details-panel"
        hidden={!selectedProject}
        tabIndex={-1}
      >
        {selectedProject && (
          <>
            <div className="project-panel-toolbar">
              <span>
                <span className="num">
                  {String(selectedIndex + 1).padStart(2, "0")} /{" "}
                  {String(projects.length).padStart(2, "0")}
                </span>{" "}
                · {selectedProject.name}
              </span>

              <div className="panel-nav">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => stepProject(-1)}
                  aria-label="Previous project"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => stepProject(1)}
                  aria-label="Next project"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close project details"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <ProjectStudy key={selectedProject.id} project={selectedProject} />
            </AnimatePresence>
          </>
        )}
      </div>
    </section>
  );
}
