import { describe, it, expect, vi } from "vitest";
import { uploadFileWithProgress } from "@/lib/upload-progress";
import type { XHRFactory } from "@/lib/upload-progress";

interface MockXHR {
  upload: { addEventListener: ReturnType<typeof vi.fn> };
  addEventListener: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  status: number;
  responseText: string;
}

function createMockXHR(overrides?: Partial<MockXHR>): MockXHR {
  const upload = {
    addEventListener: vi.fn(),
  };
  const addEventListener = vi.fn();
  const open = vi.fn();
  const send = vi.fn();

  return {
    upload,
    addEventListener,
    open,
    send,
    status: overrides?.status ?? 201,
    responseText: overrides?.responseText ?? JSON.stringify({ jobId: "test-123", state: "pending" }),
    ...overrides,
  };
}

describe("uploadFileWithProgress", () => {
  it("calls onProgress with loaded and total during upload", async () => {
    const mockXHR = createMockXHR();
    const factory: XHRFactory = () => mockXHR as unknown as XMLHttpRequest;

    const formData = new FormData();
    formData.set("file", new Blob(["test"], { type: "application/pdf" }), "test.pdf");

    const progressCalls: { loaded: number; total: number }[] = [];
    const onProgress = (p: { loaded: number; total: number }) => progressCalls.push(p);

    const uploadPromise = uploadFileWithProgress("/api/jobs", formData, onProgress, 0, factory);

    expect(mockXHR.open).toHaveBeenCalledWith("POST", "/api/jobs");

    // Simulate progress events
    const progressHandler = (mockXHR.upload.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === "progress"
    ) as [string, (e: ProgressEvent) => void] | undefined;

    if (progressHandler) {
      progressHandler[1]({ lengthComputable: true, loaded: 500, total: 1000 } as ProgressEvent);
      progressHandler[1]({ lengthComputable: true, loaded: 1000, total: 1000 } as ProgressEvent);
    }

    // Trigger load
    const loadHandler = (mockXHR.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === "load"
    ) as [string, () => void] | undefined;

    if (loadHandler) loadHandler[1]();

    const result = await uploadPromise;
    expect(result.jobId).toBe("test-123");
    expect(progressCalls.length).toBeGreaterThanOrEqual(1);
    expect(progressCalls[0].loaded).toBe(500);
    expect(progressCalls[0].total).toBe(1000);
  });

  it("rejects on HTTP error status", async () => {
    const mockXHR = createMockXHR({
      status: 400,
      responseText: JSON.stringify({ error: "Bad request" }),
    });
    const factory: XHRFactory = () => mockXHR as unknown as XMLHttpRequest;

    const formData = new FormData();
    formData.set("file", new Blob(["test"]), "test.pdf");

    const uploadPromise = uploadFileWithProgress("/api/jobs", formData, () => {}, 0, factory);

    const loadHandler = (mockXHR.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === "load"
    ) as [string, () => void] | undefined;
    if (loadHandler) loadHandler[1]();

    await expect(uploadPromise).rejects.toThrow("Bad request");
  });

  it("rejects on network error", async () => {
    const mockXHR = createMockXHR();
    const factory: XHRFactory = () => mockXHR as unknown as XMLHttpRequest;

    const formData = new FormData();
    formData.set("file", new Blob(["test"]), "test.pdf");

    const uploadPromise = uploadFileWithProgress("/api/jobs", formData, () => {}, 0, factory);

    const errorHandler = (mockXHR.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === "error"
    ) as [string, () => void] | undefined;
    if (errorHandler) errorHandler[1]();

    await expect(uploadPromise).rejects.toThrow("Network error");
  });

  it("throttles progress calls per throttleMs", async () => {
    const mockXHR = createMockXHR();
    const factory: XHRFactory = () => mockXHR as unknown as XMLHttpRequest;

    const formData = new FormData();
    formData.set("file", new Blob(["test"]), "test.pdf");

    const progressCalls: number[] = [];
    const onProgress = (p: { loaded: number }) => progressCalls.push(p.loaded);

    const uploadPromise = uploadFileWithProgress("/api/jobs", formData, onProgress, 200, factory);

    const progressHandler = (mockXHR.upload.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === "progress"
    ) as [string, (e: ProgressEvent) => void] | undefined;

    if (progressHandler) {
      // Fire multiple rapid events — throttle=200ms means only first fires
      progressHandler[1]({ lengthComputable: true, loaded: 100, total: 1000 } as ProgressEvent);
      progressHandler[1]({ lengthComputable: true, loaded: 200, total: 1000 } as ProgressEvent);
      progressHandler[1]({ lengthComputable: true, loaded: 300, total: 1000 } as ProgressEvent);
    }

    const loadHandler = (mockXHR.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === "load"
    ) as [string, () => void] | undefined;
    if (loadHandler) loadHandler[1]();

    await uploadPromise;
    expect(progressCalls.length).toBe(1);
    expect(progressCalls[0]).toBe(100);
  });

  it("handles non-computable progress events gracefully", async () => {
    const mockXHR = createMockXHR();
    const factory: XHRFactory = () => mockXHR as unknown as XMLHttpRequest;

    const formData = new FormData();
    formData.set("file", new Blob(["test"]), "test.pdf");

    const progressCalls: number[] = [];
    const onProgress = (p: { loaded: number }) => progressCalls.push(p.loaded);

    const uploadPromise = uploadFileWithProgress("/api/jobs", formData, onProgress, 0, factory);

    const progressHandler = (mockXHR.upload.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === "progress"
    ) as [string, (e: ProgressEvent) => void] | undefined;

    if (progressHandler) {
      // Non-computable — should not call onProgress
      progressHandler[1]({ lengthComputable: false, loaded: 100, total: 0 } as ProgressEvent);
      // Computable — should call
      progressHandler[1]({ lengthComputable: true, loaded: 500, total: 1000 } as ProgressEvent);
    }

    const loadHandler = (mockXHR.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === "load"
    ) as [string, () => void] | undefined;
    if (loadHandler) loadHandler[1]();

    await uploadPromise;
    expect(progressCalls.length).toBe(1);
    expect(progressCalls[0]).toBe(500);
  });
});
