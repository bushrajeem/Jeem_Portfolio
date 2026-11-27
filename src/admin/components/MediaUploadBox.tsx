import { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  getActiveStorageProvider,
  uploadPortfolioMedia,
  validateMediaFile,
  type MediaKind,
} from "../adminStorage";
import { describeError } from "../errors";
import { useAdminSession } from "../session";

export function MediaUploadBox({
  title,
  description,
  kind,
  slot,
  currentUrl,
  imageFit = "cover",
  onDeployUrl,
}: {
  title: string;
  description: string;
  kind: MediaKind;
  slot: string;
  currentUrl: string;
  imageFit?: "cover" | "contain";
  /** Called after upload completes to save the new URL live into Firestore. */
  onDeployUrl: (nextUrl: string) => Promise<void>;
}) {
  const { confirm, toast } = useAdminSession();
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  useEffect(() => {
    return () => {
      if (stagedPreviewUrl) URL.revokeObjectURL(stagedPreviewUrl);
    };
  }, [stagedPreviewUrl]);

  const clearStaged = () => {
    if (stagedPreviewUrl) URL.revokeObjectURL(stagedPreviewUrl);
    setStagedFile(null);
    setStagedPreviewUrl(null);
    setFileError("");
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const error = validateMediaFile(file, kind);
    if (error) {
      setFileError(error);
      return;
    }
    if (stagedPreviewUrl) URL.revokeObjectURL(stagedPreviewUrl);
    setFileError("");
    setStagedFile(file);
    setStagedPreviewUrl(URL.createObjectURL(file));
  };

  const handleConfirmDeploy = async () => {
    if (!stagedFile || uploading) return;
    const ok = await confirm({
      title: `Deploy new ${title}?`,
      message: `This will upload "${stagedFile.name}" and immediately update the live ${title.toLowerCase()} on your portfolio.`,
      confirmLabel: "Yes, Confirm & Deploy",
    });
    if (!ok) return;

    setUploading(true);
    setProgress(5);
    setFileError("");
    try {
      const result = await uploadPortfolioMedia(stagedFile, kind, slot, (pct) => setProgress(pct));
      await onDeployUrl(result.url);
      clearStaged();
    } catch (err) {
      const message = describeError(err);
      setFileError(message);
      toast({ kind: "error", title: `Could not deploy ${title}`, detail: message });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleManualDeploy = async () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    const ok = await confirm({
      title: `Update ${title} URL?`,
      message: `This will replace the live ${title.toLowerCase()} with:\n${trimmed}`,
      confirmLabel: "Confirm & Deploy",
    });
    if (!ok) return;

    setUploading(true);
    setFileError("");
    try {
      await onDeployUrl(trimmed);
      setManualUrl("");
      setShowUrlInput(false);
    } catch (err) {
      const message = describeError(err);
      setFileError(message);
      toast({ kind: "error", title: `Could not update ${title}`, detail: message });
    } finally {
      setUploading(false);
    }
  };

  const provider = getActiveStorageProvider();
  const accept = kind === "image" ? "image/jpeg,image/png,image/webp" : "application/pdf";

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <div className="adm-card-title">
          {kind === "image" ? <ImageIcon size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
          <div>
            <h2>{title}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--sc-ink-soft)" }}>{description}</p>
          </div>
        </div>

        <div className="adm-card-controls">
          <span className="adm-pill">
            {provider === "cloudinary" ? "Cloudinary Upload" : "Firebase Storage"}
          </span>
          <button
            type="button"
            className="adm-btn adm-btn-sm adm-btn-ghost"
            onClick={() => {
              setShowUrlInput((s) => !s);
              setManualUrl(currentUrl);
            }}
          >
            <Link2 size={13} aria-hidden="true" />
            <span>{showUrlInput ? "Hide URL" : "Paste URL"}</span>
          </button>
        </div>
      </div>

      {fileError && (
        <div className="adm-banner is-danger" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{fileError}</span>
        </div>
      )}

      <div className="adm-media-grid">
        {/* Left: Currently Deployed Preview */}
        <div className="adm-media-pane">
          <div className="adm-media-pane-head">
            <span className="adm-pill is-ok">
              <span className="adm-dot" aria-hidden="true" />
              Currently deployed
            </span>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="adm-btn adm-btn-sm adm-btn-ghost"
            >
              <span>Open</span>
              <ArrowUpRight size={12} aria-hidden="true" />
            </a>
          </div>

          <div className={`adm-media-stage${kind === "pdf" ? " is-pdf" : ""}`}>
            {kind === "image" ? (
              <img
                src={currentUrl}
                alt={`Currently deployed ${title}`}
                className={`adm-media-img${imageFit === "contain" ? " is-contain" : ""}`}
              />
            ) : (
              <iframe src={currentUrl} title={`Currently deployed ${title}`} className="adm-pdf-frame" />
            )}
          </div>

          <div className="adm-mono adm-media-url" title={currentUrl}>
            {currentUrl}
          </div>
        </div>

        {/* Right: Upload Box OR Staged Preview + Confirm & Deploy */}
        <div className="adm-media-pane">
          {!stagedFile || !stagedPreviewUrl ? (
            <>
              <div className="adm-media-pane-head">
                <span className="adm-pill">Upload replacement</span>
                <span className="adm-field-hint">
                  {kind === "image" ? "JPG, PNG, WebP · max 5 MB" : "PDF only · max 10 MB"}
                </span>
              </div>

              <label
                htmlFor={inputId}
                className={`adm-dropzone${dragOver ? " is-dragover" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
              >
                <input
                  id={inputId}
                  ref={fileInputRef}
                  type="file"
                  accept={accept}
                  className="sr-only"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <div className="adm-dropzone-icon">
                  <UploadCloud size={22} aria-hidden="true" />
                </div>
                <strong>Click to choose a {kind === "image" ? "picture" : "PDF"} or drag &amp; drop</strong>
                <span>
                  You&apos;ll see a full preview before anything goes live on your portfolio.
                </span>
              </label>
            </>
          ) : (
            <>
              <div className="adm-media-pane-head">
                <span className="adm-pill is-warn">
                  <span className="adm-dot" aria-hidden="true" />
                  New preview (not deployed yet)
                </span>
                <button
                  type="button"
                  className="adm-icon-btn"
                  onClick={clearStaged}
                  disabled={uploading}
                  aria-label="Cancel staged upload"
                  title="Cancel"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>

              <div className={`adm-media-stage is-staged${kind === "pdf" ? " is-pdf" : ""}`}>
                {kind === "image" ? (
                  <img
                    src={stagedPreviewUrl}
                    alt={`Preview of new ${title}`}
                    className={`adm-media-img${imageFit === "contain" ? " is-contain" : ""}`}
                  />
                ) : (
                  <iframe src={stagedPreviewUrl} title={`Preview of new ${title}`} className="adm-pdf-frame" />
                )}
              </div>

              <div className="adm-mono adm-media-url" title={stagedFile.name}>
                {stagedFile.name} ({(stagedFile.size / 1024).toFixed(1)} KB)
              </div>

              {uploading && (
                <div className="adm-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="adm-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              )}

              <div className="adm-media-actions">
                <button type="button" className="adm-btn" onClick={clearStaged} disabled={uploading}>
                  <span>Cancel</span>
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  onClick={() => void handleConfirmDeploy()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 size={14} className="adm-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={14} aria-hidden="true" />
                  )}
                  <span>{uploading ? `Uploading ${progress}%...` : "Confirm & Deploy Live"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showUrlInput && (
        <div className="adm-sub-panel">
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
            Deploy via direct path or HTTPS URL
          </div>
          <div className="adm-list-row" style={{ flexWrap: "wrap" }}>
            <input
              type="text"
              className="adm-input adm-mono"
              style={{ flex: "1 1 260px" }}
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder={kind === "image" ? "https://... or /jeem-portrait.jpg" : "https://... or /CV.pdf"}
            />
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => void handleManualDeploy()}
              disabled={uploading || !manualUrl.trim() || manualUrl.trim() === currentUrl}
            >
              <span>Confirm &amp; Deploy URL</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
