const KEY = "betterme:seen-shared-pages";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function getSeenSharedIds(): Set<string> {
  return read();
}

export function markSharedSeen(id: string) {
  if (typeof window === "undefined") return;
  const s = read();
  if (s.has(id)) return;
  s.add(id);
  window.localStorage.setItem(KEY, JSON.stringify([...s]));
  window.dispatchEvent(new CustomEvent("shared-seen-changed"));
}

export function subscribeSharedSeen(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("shared-seen-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("shared-seen-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
