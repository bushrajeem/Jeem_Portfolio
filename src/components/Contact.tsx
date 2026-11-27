import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Copy, FileText, Loader2, Mail } from "lucide-react";
import { usePortfolio } from "../context/PortfolioContext";
import { isFirebaseConfigured } from "../lib/firebase";
import { submitContactMessage } from "../lib/firestore";
import { GitHubLogo, LinkedInLogo } from "./ui/Logos";
import { Reveal, WaveText } from "./ui/Motion";

type SubmitState = "idle" | "submitting" | "sent" | "draft" | "error";

export function Contact() {
  const { profile } = usePortfolio();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [feedback, setFeedback] = useState<string>("");
  const [draftUrl, setDraftUrl] = useState<string | null>(null);

  const buildMailtoUrl = () => {
    const sender = name.trim() || "Portfolio visitor";
    const subject = encodeURIComponent(`Hello Jeem — from ${sender}`);
    const bodyLines = [
      message.trim() || "Hi Jeem,",
      "",
      `— ${sender}${email.trim() ? ` (${email.trim()})` : ""}`,
    ];
    return `mailto:${profile.email}?subject=${subject}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isFirebaseConfigured) {
      const url = buildMailtoUrl();
      setDraftUrl(url);
      setSubmitState("draft");
      setFeedback("Your email draft is ready.");
      window.location.href = url;
      return;
    }

    setSubmitState("submitting");
    setFeedback("");
    setDraftUrl(null);

    try {
      await submitContactMessage({ name, email, message });
      setName("");
      setEmail("");
      setMessage("");
      setSubmitState("sent");
      setFeedback("Message sent! Thanks for reaching out — I'll get back to you soon.");
    } catch (err) {
      const fallbackUrl = buildMailtoUrl();
      setDraftUrl(fallbackUrl);
      setSubmitState("error");
      const reason =
        err instanceof Error && err.message
          ? err.message
          : "Could not send right now.";
      setFeedback(`${reason} You can also open your message in your mail client.`);
    }
  };

  const isSubmitting = submitState === "submitting";

  return (
    <section id="contact" className="contact-section wrap" aria-labelledby="contact-heading">
      <div className="contact-layout">
        <Reveal className="contact-opening">
          <h2 id="contact-heading">Let&apos;s talk.</h2>
          <p>
            Currently seeking {profile.seeking}. Whether it&apos;s a role, research collaboration,
            or project inquiry, my inbox is open.
          </p>

          <div className="contact-details">
            <div className="email-block">
              <a href={`mailto:${profile.email}`} className="email-link wave-target">
                <Mail size={19} />
                <WaveText>{profile.email}</WaveText>
              </a>
              <button
                type="button"
                className="icon-button copy-email"
                onClick={handleCopy}
                aria-label="Copy email address"
                title="Copy email address"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <span className="copy-status" role="status" aria-live="polite">
              {copied ? "Copied to clipboard." : ""}
            </span>
          </div>

          <div className="social-links">
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="wave-target"
            >
              <LinkedInLogo />
              <WaveText>LinkedIn</WaveText>
              <ArrowUpRight size={14} />
            </a>

            <a
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
              className="wave-target"
            >
              <GitHubLogo />
              <WaveText>GitHub</WaveText>
              <ArrowUpRight size={14} />
            </a>

            <a
              href={profile.resume}
              target="_blank"
              rel="noopener noreferrer"
              className="wave-target"
            >
              <FileText size={17} />
              <WaveText>Resume PDF</WaveText>
              <ArrowUpRight size={14} />
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="contact-field">
              <label htmlFor="contact-name">Your name</label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="contact-field">
              <label htmlFor="contact-email">Email address</label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="contact-field contact-message">
              <label htmlFor="contact-message">What do you have in mind?</label>
              <textarea
                id="contact-message"
                name="message"
                placeholder="Tell me about the role, team, or project."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <div className="contact-submit">
              <button
                type="submit"
                className="draft-button wave-target"
                disabled={isSubmitting}
              >
                <WaveText>
                  {isSubmitting
                    ? "Sending..."
                    : isFirebaseConfigured
                      ? "Send message"
                      : "Create email draft"}
                </WaveText>
                {isSubmitting ? (
                  <Loader2 size={18} className="contact-spinner" aria-hidden="true" />
                ) : (
                  <ArrowUpRight size={18} />
                )}
              </button>

              <a href={`mailto:${profile.email}`} className="text-link wave-target">
                <WaveText>{`Email ${profile.shortName} directly`}</WaveText>
                <ArrowUpRight size={14} />
              </a>
            </div>

            {feedback && (
              <div
                className={`draft-ready${submitState === "error" ? " contact-feedback-error" : ""}`}
                role={submitState === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                <p>{feedback}</p>
                {draftUrl && (
                  <a href={draftUrl} className="draft-link">
                    <span>Open in mail client</span>
                    <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
            )}
          </form>
        </Reveal>
      </div>
    </section>
  );
}
