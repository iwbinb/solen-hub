// Toast notification queue.

export type ToastLevel = "info" | "ok" | "warn" | "error";

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container) return container;
  container = document.createElement("div");
  container.id = "toasts";
  document.body.appendChild(container);
  return container;
}

export function toast(msg: string, level: ToastLevel = "info", ttl = 4500) {
  const el = document.createElement("div");
  el.className = `toast toast-${level}`;
  el.textContent = msg;
  ensureContainer().appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, ttl);
}

export async function copy(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(label, "ok", 1800);
  } catch {
    toast("Clipboard blocked", "warn");
  }
}
