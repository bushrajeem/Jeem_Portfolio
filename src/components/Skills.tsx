import { usePortfolio } from "../context/PortfolioContext";
import { Reveal } from "./ui/Motion";

export function Skills() {
  const { skills } = usePortfolio();
  return (
    <section id="skills" className="skills-section" aria-labelledby="skills-heading">
      <div className="wrap">
        <Reveal className="split-heading">
          <h2 id="skills-heading">Tech Stack</h2>
          <p>
            The tools behind
            <br />
            my work.
          </p>
        </Reveal>

        <div className="skills-specimens">
          {skills.map((group, idx) => (
            <Reveal key={group.id} delay={idx * 0.08} className="skills-specimen">
              <article aria-labelledby={`skills-${group.id}`}>
                <h3 id={`skills-${group.id}`}>{group.title}</h3>
                <p className="skills-specimen-note">{group.note}</p>
                <ul className="skills-type-mosaic">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
