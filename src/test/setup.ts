import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// next/font/google is a build-time transform executed by the Next compiler,
// which vitest does not run. Without this every named import resolves to
// undefined and any module that calls one throws at import time.
//
// Named exports have to be declared explicitly — an ESM named import cannot
// be satisfied by a Proxy — so a new font added to src/lib/fonts.ts needs a
// line here too.
vi.mock("next/font/google", () => {
  const loader = () => ({
    variable: "--font-test",
    className: "font-test",
    style: { fontFamily: "serif" },
  });
  return { Inter: loader, Playfair_Display: loader };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom has no ResizeObserver, and BaseMap now uses one to keep the map sized
// to its container.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
