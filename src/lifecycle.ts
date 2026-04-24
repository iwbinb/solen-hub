// Per-view lifecycle: the router calls disposeAll() before mounting a new view,
// so views can freely push timer/listener cleanups via onDispose().

const disposers: Array<() => void> = [];

export function onDispose(fn: () => void) {
  disposers.push(fn);
}

export function disposeAll() {
  while (disposers.length) {
    try {
      disposers.pop()!();
    } catch (e) {
      console.warn("dispose failed", e);
    }
  }
}

export function setInt(fn: () => void, ms: number): number {
  const id = window.setInterval(fn, ms);
  onDispose(() => clearInterval(id));
  return id;
}

export function listen<K extends keyof WindowEventMap>(
  ev: K,
  h: (e: WindowEventMap[K]) => void,
  target: EventTarget = window,
) {
  target.addEventListener(ev, h as EventListener);
  onDispose(() => target.removeEventListener(ev, h as EventListener));
}
