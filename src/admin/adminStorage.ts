import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseStorage } from "../lib/firebase";
import { isSafeHref, isSafeImageSrc } from "../lib/safeUrl";

export type MediaKind = "image" | "pdf";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateMediaFile(file: File, kind: MediaKind): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (kind === "image") {
    if (!IMAGE_MIME.has(file.type) || !IMAGE_EXT.has(ext)) {
      return "Only JPG, PNG, or WebP images are allowed (SVG and scripts are blocked for security).";
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return `Image must be 5 MB or smaller (selected file is ${(file.size / 1024 / 1024).toFixed(2)} MB).`;
    }
    return null;
  }

  if (file.type !== "application/pdf" || ext !== "pdf") {
    return "Only PDF files (.pdf) are allowed for your CV / Resume.";
  }
  if (file.size > MAX_PDF_BYTES) {
    return `PDF must be 10 MB or smaller (selected file is ${(file.size / 1024 / 1024).toFixed(2)} MB).`;
  }
  return null;
}

export type UploadResult = {
  url: string;
  provider: "firebase-storage" | "cloudinary";
};

function getCloudinaryConfig(): { cloudName: string; uploadPreset: string } | null {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !uploadPreset) return null;
  return { cloudName, uploadPreset };
}

export function getActiveStorageProvider(): "cloudinary" | "firebase-storage" {
  return getCloudinaryConfig() ? "cloudinary" : "firebase-storage";
}

function uploadToCloudinary(
  file: File,
  kind: MediaKind,
  slot: string,
  config: { cloudName: string; uploadPreset: string },
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const resourceType = kind === "image" ? "image" : "raw";
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`;
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", config.uploadPreset);
    form.append("folder", "jeem-portfolio");
    form.append("public_id", `${slot}-${Date.now()}`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as { secure_url?: string; error?: { message?: string } };
        if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
          const valid = kind === "image" ? isSafeImageSrc(body.secure_url) : isSafeHref(body.secure_url);
          if (!valid) {
            reject(new Error("Upload returned an unsafe URL."));
            return;
          }
          resolve({ url: body.secure_url, provider: "cloudinary" });
          return;
        }
        reject(new Error(body.error?.message || `Cloudinary upload failed (HTTP ${xhr.status}).`));
      } catch {
        reject(new Error("Could not parse Cloudinary upload response."));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading to Cloudinary."));
    xhr.send(form);
  });
}

function uploadToFirebaseStorage(
  file: File,
  kind: MediaKind,
  slot: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "pdf" ? "pdf" : "jpg");
    const safeSlot = slot.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "asset";
    const storagePath = `portfolio/media/${safeSlot}-${Date.now()}.${ext}`;
    const storageRef = ref(getFirebaseStorage(), storagePath);

    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000",
    });

    task.on(
      "state_changed",
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, provider: "firebase-storage" });
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

/**
 * Validates and uploads a portrait image or CV PDF.
 * Uses Cloudinary when configured (free tier, no billing card required),
 * otherwise uses Firebase Storage protected by `storage.rules`.
 */
export async function uploadPortfolioMedia(
  file: File,
  kind: MediaKind,
  slot: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const err = validateMediaFile(file, kind);
  if (err) throw new Error(err);

  const cloudinary = getCloudinaryConfig();
  if (cloudinary) {
    return uploadToCloudinary(file, kind, slot, cloudinary, onProgress);
  }
  return uploadToFirebaseStorage(file, kind, slot, onProgress);
}
