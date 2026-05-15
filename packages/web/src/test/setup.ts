import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined" && !window.IntersectionObserver) {
  class IntersectionObserverMock implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];

    constructor(private readonly callback: IntersectionObserverCallback) {}

    disconnect(): void {}
    unobserve(_target: Element): void {}
    takeRecords(): IntersectionObserverEntry[] { return []; }

    observe(target: Element): void {
      this.callback(
        [
          {
            isIntersecting: true,
            target,
            intersectionRatio: 1,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
            time: Date.now(),
          },
        ],
        this,
      );
    }
  }

  window.IntersectionObserver = IntersectionObserverMock;
  globalThis.IntersectionObserver = IntersectionObserverMock;
}
