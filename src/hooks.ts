import { useEffect, useState, useSyncExternalStore } from "react";

/* ---------- hash router ---------- */

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

/** Route segments from `#/a/b/c` → ["a", "b", "c"]. */
export function useRoute() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  return hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

export function go(path: string) {
  window.location.hash = path;
}

/* ---------- clock ---------- */

/** Current time, re-rendered every animation frame while `active`. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return active ? now : Date.now();
}

/* ---------- theme ---------- */

type Theme = "dark" | "light";

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

const themeListeners = new Set<() => void>();

export function useTheme() {
  const theme = useSyncExternalStore((cb) => {
    themeListeners.add(cb);
    return () => themeListeners.delete(cb);
  }, readTheme);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("sst-theme", next);
    } catch {
      /* */
    }
    themeListeners.forEach((l) => l());
  };
  return { theme, toggle };
}

/** Run `handler` on keydown, ignoring keystrokes aimed at form fields. */
export function useKeys(handler: (e: KeyboardEvent) => void, deps: unknown[]) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      handler(e);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
