// App shell: header, nav, wallet widget, wallet connect modal, Cmd+K search.

import { el, on, clear } from "./dom.js";
import { t, currentLang, setLang } from "./i18n.js";
import * as store from "./store.js";
import * as wallet from "./wallet.js";
import { go, currentPath } from "./router.js";
import { toast, copy } from "./toast.js";
import { identicon } from "./identicon.js";
import { shortHex, isHex32, normalizeAddr } from "./format.js";
import { getRpc } from "./rpc.js";

const NAV: Array<{ path: string; key: string }> = [
  { path: "/", key: "nav.dashboard" },
  { path: "/explorer", key: "nav.explorer" },
  { path: "/validators", key: "nav.validators" },
  { path: "/staking", key: "nav.staking" },
  { path: "/portfolio", key: "nav.portfolio" },
  { path: "/send", key: "nav.send" },
  { path: "/governance", key: "nav.governance" },
];

export function renderShell(mount: HTMLElement) {
  const app = el("div", { id: "app" });
  const header = buildHeader();
  const nav = buildNav();
  const outlet = el("main", { id: "outlet", class: "outlet" });

  app.append(header, nav, outlet);
  mount.innerHTML = "";
  mount.append(app);

  wallet.onChange(() => {
    refreshWalletWidget(header);
  });
  store.onChange((k) => {
    if (k === "language") {
      location.reload();
    }
  });

  document.addEventListener("hub:open-wallet", openWalletModal);
  document.addEventListener("hub:open-search", openSearchPalette);

  window.addEventListener("keydown", (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearchPalette();
    }
    if (e.key === "Escape") closeAllModals();
  });

  return outlet;
}

export function highlightActive() {
  const path = currentPath();
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((el) => {
    const p = el.dataset.nav!;
    const active = p === "/" ? path === "/" : path === p || path.startsWith(p + "/");
    el.classList.toggle("active", active);
  });
}

// ── Header ────────────────────────────────────────────────────────────

function buildHeader(): HTMLElement {
  const h = el("header", { id: "header" });

  const left = el("div", { class: "brand" }, [
    el("span", { class: "brand-logo" }, "◎"),
    el("div", { class: "brand-text" }, [
      el("div", { class: "brand-name" }, "Solen Hub"),
      el("div", { class: "brand-tag muted small" }, t("app.tagline")),
    ]),
  ]);
  on(left, "click", () => go("/"));

  const searchBar = el("button", { class: "search-trigger", id: "search-trigger" }, [
    el("span", null, "🔍 " + t("search.placeholder")),
    el("span", { class: "kbd" }, "⌘K"),
  ]);
  on(searchBar, "click", openSearchPalette);

  const right = el("div", { class: "header-right", id: "header-right" });

  h.append(left, searchBar, right);
  refreshWalletWidget(h);
  return h;
}

function refreshWalletWidget(header: HTMLElement) {
  const right = header.querySelector<HTMLElement>("#header-right");
  if (!right) return;
  clear(right);

  // lang toggle
  const langBtn = el("button", { class: "btn-ghost sm" }, currentLang() === "zh" ? "EN" : "中");
  on(langBtn, "click", () => {
    setLang(currentLang() === "zh" ? "en" : "zh");
  });

  // theme toggle
  const themeBtn = el("button", { class: "btn-ghost sm icon-only", title: t("settings.theme") }, "☾");
  on(themeBtn, "click", () => {
    const cur = store.get("theme");
    const next = cur === "dark" ? "light" : cur === "light" ? "system" : "dark";
    store.set("theme", next);
  });

  right.append(langBtn, themeBtn);

  const acct = wallet.accountId();
  if (!acct) {
    const connectBtn = el("button", { class: "btn-primary" }, t("wallet.connect"));
    on(connectBtn, "click", openWalletModal);
    right.append(connectBtn);
    return;
  }

  const widget = el("div", { class: "wallet-widget" }, [
    el("span", { class: "wallet-ic", html: identicon(acct, 28) }),
    el("span", { class: "wallet-addr mono" }, shortHex(acct, 6, 4)),
    wallet.mode() === "sign"
      ? el("span", { class: "pill on sm" }, t("wallet.mode.sign"))
      : el("span", { class: "pill gen sm" }, t("wallet.mode.watch")),
    el("span", { class: "chev" }, "▾"),
  ]);
  const menu = buildWalletMenu(acct);
  widget.append(menu);
  on(widget, "click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });
  document.addEventListener("click", () => menu.classList.remove("open"));
  right.append(widget);
}

function buildWalletMenu(acct: string): HTMLElement {
  const menu = el("div", { class: "wallet-menu" });
  const items: Array<[string, () => void]> = [
    [t("wallet.copy") + " · " + shortHex(acct), () => copy(acct, t("toast.copied"))],
    [t("common.view") + " · " + t("account.title"), () => go(`/account/${acct}`)],
    [t("nav.settings"), () => go("/settings")],
  ];
  if (wallet.canSign()) {
    items.push([t("wallet.lock"), () => wallet.lock()]);
  }
  items.push([t("wallet.disconnect"), () => wallet.disconnect()]);
  for (const [label, fn] of items) {
    const it = el("div", { class: "wallet-menu-item" }, label);
    on(it, "click", (e) => {
      e.stopPropagation();
      fn();
    });
    menu.append(it);
  }
  return menu;
}

// ── Nav ────────────────────────────────────────────────────────────────

function buildNav(): HTMLElement {
  const nav = el("nav", { class: "mainnav" });
  for (const n of NAV) {
    const a = el("a", { href: "#" + n.path, "data-nav": n.path }, t(n.key));
    nav.append(a);
  }
  const settingsLink = el("a", { href: "#/settings", "data-nav": "/settings", class: "mainnav-right" }, "⚙ " + t("nav.settings"));
  nav.append(settingsLink);
  return nav;
}

// ── Wallet modal ───────────────────────────────────────────────────────

function openWalletModal() {
  closeAllModals();
  const overlay = el("div", { class: "modal-overlay", id: "wallet-modal" });
  const modal = el("div", { class: "modal" });
  const head = el("div", { class: "modal-head" }, [
    el("h3", null, t("wallet.modal.title")),
    (() => {
      const x = el("button", { class: "btn-ghost sm icon-only" }, "×");
      on(x, "click", closeAllModals);
      return x;
    })(),
  ]);

  const tabs = el("div", { class: "tabs-inline" });
  const signTab = el("button", { class: "tab-inline active" }, t("wallet.modal.seed_tab"));
  const watchTab = el("button", { class: "tab-inline" }, t("wallet.modal.watch_tab"));
  const hwTab = el("button", { class: "tab-inline disabled", disabled: "disabled" }, "Ledger");
  tabs.append(signTab, watchTab, hwTab);

  const body = el("div", { class: "modal-body" });
  modal.append(head, tabs, body);
  overlay.append(modal);
  document.body.append(overlay);
  on(overlay, "click", (e) => {
    if (e.target === overlay) closeAllModals();
  });

  function showSign() {
    signTab.classList.add("active");
    watchTab.classList.remove("active");
    clear(body);
    const warn = el(
      "div",
      { class: "hint warn" },
      "⚠️ " + t("wallet.seed_warning_body"),
    );
    const input = el("input", {
      class: "input wide",
      type: "password",
      placeholder: t("wallet.modal.seed_placeholder"),
    }) as HTMLInputElement;
    const btn = el("button", { class: "btn-primary wide" }, t("wallet.modal.unlock"));
    on(btn, "click", async () => {
      try {
        await wallet.unlockWithSeed(input.value);
        store.set("acknowledgedSeedWarning", true);
        toast(t("toast.connected", { short: shortHex(wallet.accountId()!) }), "ok");
        closeAllModals();
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });
    const hwNote = el("p", { class: "muted small" }, t("wallet.modal.hardware_soon"));
    body.append(warn, input, btn, hwNote);
    input.focus();
  }

  function showWatch() {
    watchTab.classList.add("active");
    signTab.classList.remove("active");
    clear(body);
    const input = el("input", {
      class: "input wide",
      placeholder: t("wallet.modal.watch_placeholder"),
    }) as HTMLInputElement;
    const btn = el("button", { class: "btn-primary wide" }, t("wallet.modal.watch"));
    on(btn, "click", () => {
      try {
        wallet.watchAddress(input.value);
        toast(t("toast.connected", { short: shortHex(wallet.accountId()!) }), "ok");
        closeAllModals();
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });
    body.append(input, btn);
    input.focus();
  }

  on(signTab, "click", showSign);
  on(watchTab, "click", showWatch);
  showSign();
}

// ── Search palette (Cmd+K) ─────────────────────────────────────────────

function openSearchPalette() {
  closeAllModals();
  const overlay = el("div", { class: "modal-overlay search-overlay", id: "search-modal" });
  const modal = el("div", { class: "modal search-modal" });
  const input = el("input", {
    class: "search-input",
    placeholder: t("search.placeholder"),
    autofocus: "",
  }) as HTMLInputElement;
  const results = el("div", { class: "search-results" });
  modal.append(input, results);
  overlay.append(modal);
  document.body.append(overlay);
  on(overlay, "click", (e) => {
    if (e.target === overlay) closeAllModals();
  });

  function paint(q: string) {
    clear(results);
    q = q.trim();
    if (!q) {
      results.append(el("div", { class: "search-empty muted" }, t("search.empty")));
      return;
    }
    const clean = q.replace(/^0x/, "").toLowerCase();
    if (isHex32(clean)) {
      addResult(results, "🪪", t("search.open_account"), shortHex(clean), () =>
        go(`/account/${clean}`),
      );
      addResult(results, "👤", t("search.open_validator"), shortHex(clean), () =>
        go(`/validator/${clean}`),
      );
    } else if (/^\d+$/.test(q)) {
      addResult(results, "🧱", t("search.open_block"), `#${q}`, () => go(`/block/${q}`));
    } else {
      results.append(el("div", { class: "search-empty muted" }, t("search.empty")));
    }
  }

  input.addEventListener("input", () => paint(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = results.querySelector<HTMLElement>(".sres");
      first?.click();
    }
  });
  paint("");
  requestAnimationFrame(() => input.focus());
}

function addResult(root: HTMLElement, icn: string, primary: string, secondary: string, fn: () => void) {
  const r = el("div", { class: "sres" }, [
    el("span", { class: "sres-ic" }, icn),
    el("div", { class: "sres-text" }, [
      el("div", { class: "sres-primary" }, primary),
      el("div", { class: "sres-secondary muted small" }, secondary),
    ]),
    el("span", { class: "sres-arrow" }, "↵"),
  ]);
  on(r, "click", () => {
    fn();
    closeAllModals();
  });
  root.append(r);
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
}

// Suppress-unused for getRpc import (kept for future search-by-identity etc.)
void getRpc;
void normalizeAddr;
