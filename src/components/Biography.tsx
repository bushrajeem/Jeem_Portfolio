import { ArrowDownRight, FileText } from "lucide-react";
import { academics, bio, profile } from "../data/portfolio";
import { Reveal, WaveText } from "./ui/Motion";
import { Portrait } from "./ui/Portrait";

export function Biography() {
  return (
    <div id="biography" className="biography wrap" aria-labelledby="about-heading">
      <Reveal className="bio-introduction">
        <h2 id="about-heading">
          Hi, I&apos;m
          <br />
          {profile.shortName}.
        </h2>

        <p className="bio-role">
          {profile.roleLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>

        <div className="bio-current">
          <span>Currently at</span>
          <p>
            <strong>{academics.university}</strong>
            <span className="num">
              {academics.standing} · {academics.degreeShort}
            </span>
            <span>{profile.location}</span>
          </p>
        </div>
      </Reveal>

      {/* Statically positioned dock for the 3D scroll portrait journey */}
      <figure className="bio-portrait">
        <Portrait className="rounded-16" />
      </figure>

      <Reveal delay={0.14} className="bio-description">
        <p className="bio-lead">
          {bio.lead.map((part, idx) =>
            part.strong ? (
              <strong key={idx}>{part.text}</strong>
            ) : (
              <span key={idx}>{part.text}</span>
            ),
          )}
        </p>

        <div className="bio-actions">
          <a href="#projects" className="bio-projects wave-target">
            <WaveText>Explore projects</WaveText>
            <ArrowDownRight size={18} />
          </a>

          <a
            href={profile.resume}
            target="_blank"
            rel="noopener noreferrer"
            className="wave-target"
          >
            <WaveText>Download CV</WaveText>
            <FileText size={16} />
          </a>
        </div>
      </Reveal>
    </div>
  );
}
