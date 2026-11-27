import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { ProfileData } from "../../data/portfolio";
import { isSafeHref, isSafeImageSrc } from "../../lib/safeUrl";
import { loadSingleton, saveSingleton } from "../adminData";
import { MediaUploadBox } from "../components/MediaUploadBox";
import { commitTitle, useAdminSession } from "../session";

export function MediaSection() {
  const { actor, toast, handleError } = useAdminSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadSingleton("profile");
      setProfile(res.value);
    } catch (err) {
      handleError(err, "load media assets");
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  const deployField = async (
    field: "portrait" | "footerPortrait" | "resume",
    nextUrl: string,
    label: string,
  ) => {
    if (!profile) return;
    const valid = field === "resume" ? isSafeHref(nextUrl) : isSafeImageSrc(nextUrl);
    if (!valid) {
      throw new Error(
        field === "resume"
          ? "Resume URL must start with https:// or / (no spaces or scripts)."
          : "Image URL must start with https:// or / (no spaces or scripts).",
      );
    }

    const updated: ProfileData = { ...profile, [field]: nextUrl };
    await saveSingleton("profile", updated, actor);
    setProfile(updated);
    toast({
      kind: "success",
      title: commitTitle(`deploy ${field}`),
      detail: `${label} is now live on your portfolio!`,
    });
  };

  return (
    <>
      <div className="adm-section-head">
        <div>
          <h1>Media &amp; CV Uploads</h1>
          <p>
            Inspect your currently deployed photos and CV PDF side-by-side. Drop a new file to preview it first, then
            click <strong>Confirm &amp; Deploy Live</strong> to push it to your portfolio.
          </p>
        </div>

        <div className="adm-commit-bar">
          <button type="button" className="adm-btn" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "adm-spin" : ""} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading || !profile ? (
        <div className="adm-banner">
          <Loader2 size={16} className="adm-spin" aria-hidden="true" />
          <span>Loading currently deployed media assets...</span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          <MediaUploadBox
            title="Hero & Biography Portrait"
            description="Used in the Hero section, Biography card, and the 3D scroll flip animation."
            kind="image"
            slot="portrait"
            currentUrl={profile.portrait}
            imageFit="cover"
            onDeployUrl={(url) => deployField("portrait", url, "Hero & Biography Portrait")}
          />

          <MediaUploadBox
            title="Resume / CV PDF"
            description="Linked from the Biography Download CV button, Navigation menu, Contact section, and Footer."
            kind="pdf"
            slot="resume-cv"
            currentUrl={profile.resume}
            onDeployUrl={(url) => deployField("resume", url, "Resume / CV PDF")}
          />

          <MediaUploadBox
            title="Footer Crowd Character Image"
            description="Standing character illustration centered in the interactive Dhaka crowd footer scene."
            kind="image"
            slot="footer-portrait"
            currentUrl={profile.footerPortrait || "/footer/animated_jeem.webp"}
            imageFit="contain"
            onDeployUrl={(url) => deployField("footerPortrait", url, "Footer Character Image")}
          />
        </div>
      )}
    </>
  );
}
