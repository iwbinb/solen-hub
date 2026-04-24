// Minimal hash-based router with path params (":id") and a single outlet.

type Handler = (params: Record<string, string>) => void | Promise<void>;

interface Route {
  pattern: string;
  keys: string[];
  re: RegExp;
  handler: Handler;
}

const routes: Route[] = [];
let notFound: Handler = () => {};
let beforeEach: (path: string) => void = () => {};

export function route(pattern: string, handler: Handler) {
  const keys: string[] = [];
  const regexStr =
    "^" +
    pattern.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => {
      keys.push(k);
      return "([^/]+)";
    }) +
    "$";
  routes.push({ pattern, keys, re: new RegExp(regexStr), handler });
}

export function fallback(handler: Handler) {
  notFound = handler;
}

export function onNavigate(fn: (path: string) => void) {
  beforeEach = fn;
}

export function currentPath(): string {
  const hash = location.hash || "#/";
  return hash.startsWith("#") ? hash.slice(1) || "/" : "/";
}

export function go(path: string) {
  if (currentPath() === path) {
    dispatch();
  } else {
    location.hash = "#" + path;
  }
}

export function replace(path: string) {
  const url = new URL(window.location.href);
  url.hash = "#" + path;
  history.replaceState(null, "", url.toString());
  dispatch();
}

function dispatch() {
  const path = currentPath();
  beforeEach(path);
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });
      Promise.resolve(r.handler(params)).catch((e) => {
        console.error("route handler failed:", e);
      });
      return;
    }
  }
  notFound({});
}

export function start() {
  window.addEventListener("hashchange", dispatch);
  dispatch();
}
