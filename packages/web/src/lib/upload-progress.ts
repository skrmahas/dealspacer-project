/**
 * Upload a file via XMLHttpRequest with progress tracking.
 * Falls back to fetch-based upload if XMLHttpRequest is unavailable.
 */

export interface UploadProgress {
  loaded: number;
  total: number;
}

export interface UploadResult {
  jobId: string;
  state: string;
}

export interface UploadError {
  error: string;
}

export type XHRFactory = () => XMLHttpRequest;

export type AbortFn = () => void;

export function uploadFileWithProgress(
  url: string,
  formData: FormData,
  onProgress: (progress: UploadProgress) => void,
  throttleMs = 200,
  xhrFactory?: XHRFactory,
  abortRef?: { current: AbortFn | null },
): Promise<UploadResult> {
  const hasUpload =
    typeof XMLHttpRequest !== "undefined" &&
    "upload" in XMLHttpRequest.prototype;

  if (hasUpload) {
    return uploadWithXHR(url, formData, onProgress, throttleMs, xhrFactory, abortRef);
  }
  return uploadWithFetch(url, formData);
}

function uploadWithXHR(
  url: string,
  formData: FormData,
  onProgress: (progress: UploadProgress) => void,
  throttleMs: number,
  xhrFactory?: XHRFactory,
  abortRef?: { current: AbortFn | null },
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = xhrFactory ? xhrFactory() : new XMLHttpRequest();
    let lastEmit = 0;

    // Expose abort function to caller
    if (abortRef) {
      abortRef.current = () => {
        try { xhr.abort(); } catch { /* ignore */ }
      };
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const now = Date.now();
      if (now - lastEmit < throttleMs) return;
      lastEmit = now;
      onProgress({ loaded: event.loaded, total: event.total });
    });

    const cleanup = () => {
      if (abortRef) abortRef.current = null;
    };

    xhr.addEventListener("load", () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as UploadResult;
          resolve(result);
        } catch {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as UploadError;
          reject(new Error(err.error || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      cleanup();
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      cleanup();
      reject(new Error("Upload aborted"));
    });

    xhr.open("POST", url);
    xhr.send(formData);
  });
}

async function uploadWithFetch(
  url: string,
  formData: FormData,
): Promise<UploadResult> {
  const response = await fetch(url, { method: "POST", body: formData });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error((payload as UploadError).error || "Upload failed");
  }
  return payload as UploadResult;
}
