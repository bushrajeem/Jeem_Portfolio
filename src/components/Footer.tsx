import { ArrowUpRight } from "lucide-react";
import { usePortfolio } from "../context/PortfolioContext";
import { FooterCrowd } from "./FooterCrowd";
import { WaveText } from "./ui/Motion";

export function Footer() {
  const { navLinks, profile } = usePortfolio();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <div className="footer-identity">
            <h2>{`${profile.shortName}.`}</h2>
            <p>
              {profile.roleLines[0]}
              <br />
              {profile.roleLines[1]}
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <p>Explore</p>
            <div>
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="wave-target">
                  <WaveText>{link.label}</WaveText>
                </a>
              ))}
              <a
                href={profile.resume}
                target="_blank"
                rel="noopener noreferrer"
                className="wave-target"
              >
                <WaveText>Resume</WaveText>
              </a>
            </div>
          </nav>

          <div className="footer-contact">
            <p>Get in touch</p>
            <a href={`mailto:${profile.email}`} className="wave-target">
              <WaveText>{profile.email}</WaveText>
              <ArrowUpRight size={14} />
            </a>
            <span className="num">
              © {profile.year} {profile.name}
            </span>
          </div>
        </div>
      </div>

      <FooterCrowd />
    </footer>
  );
}
