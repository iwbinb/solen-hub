import * as store from "./store.js";
import type { Theme } from "./store.js";

function resolved(t: Theme): "dark" | "light" {
  if (t === "system") {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return t;
}

export function applyTheme() {
  const t = store.get("theme");
  document.documentElement.dataset.theme = resolved(t);
}

export function initTheme() {
  applyTheme();
  store.onChange((k) => {
    if (k === "theme") applyTheme();
  });
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
      if (store.get("theme") === "system") applyTheme();
    });
  }
}
