/** Bambu Studio handoff helpers. */

export type BambuConnectLaunch = {
  url: string;
  path: string;
  name: string;
  filename: string;
  docs_url: string;
  install_url: string;
};

export const BAMBU_CONNECT_INSTALL_URL = "https://wiki.bambulab.com/en/software/bambu-connect";
export const BAMBU_CONNECT_DOCS_URL =
  "https://wiki.bambulab.com/en/software/third-party-integration";

/** Open a custom protocol; browsers may warn if no app is registered. */
export function launchCustomProtocol(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function launchBambuConnectUrl(url: string) {
  launchCustomProtocol(url);
}

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /Mac|iPhone|iPad|iPod/i.test(ua) || /Mac/i.test(platform);
}

/**
 * Open a remotely fetchable 3MF in Bambu Studio.
 * macOS: bambustudioopen://{httpUrl}
 * Windows/Linux: bambustudio://open?file={encodedUrl}
 */
export function buildBambuStudioOpenUrl(fileHttpUrl: string): string {
  if (isApplePlatform()) {
    return `bambustudioopen://${fileHttpUrl}`;
  }
  return `bambustudio://open?file=${encodeURIComponent(fileHttpUrl)}`;
}

export function publicDownloadUrl(jobId: string): string {
  if (typeof window === "undefined") return `/api/download/${jobId}`;
  return `${window.location.origin}/api/download/${jobId}`;
}

/**
 * Open Bambu Studio immediately via its URL scheme.
 * Skips Bambu Connect — that path added delay and a second handoff.
 */
export function launchBambuHandoff(options: { jobId: string }): { studioUrl: string } {
  const fileUrl = publicDownloadUrl(options.jobId);
  const studioUrl = buildBambuStudioOpenUrl(fileUrl);
  launchCustomProtocol(studioUrl);
  return { studioUrl };
}
