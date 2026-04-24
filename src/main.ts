// Solen Hub — bootstrap: theme, wallet, router, views.

import { initTheme } from "./theme.js";
import { renderShell, highlightActive } from "./shell.js";
import * as router from "./router.js";
import { mount } from "./dom.js";
import { disposeAll } from "./lifecycle.js";
import * as wallet from "./wallet.js";
import { toast } from "./toast.js";

import { render as Dashboard } from "./views/dashboard.js";
import { render as Explorer } from "./views/explorer.js";
import { render as Block } from "./views/block.js";
import { render as Account } from "./views/account.js";
import { render as Validators } from "./views/validators.js";
import { render as Validator } from "./views/validator.js";
import { render as Staking } from "./views/staking.js";
import { render as Portfolio } from "./views/portfolio.js";
import { render as Send } from "./views/send.js";
import { render as Governance } from "./views/governance.js";
import { render as Settings } from "./views/settings.js";

initTheme();
wallet.initFromStorage();
wallet.initAutoLockActivity();

const appRoot = document.getElementById("app-root");
if (!appRoot) throw new Error("missing #app-root");
const outlet = renderShell(appRoot);

async function renderInto(viewPromise: Promise<HTMLElement>) {
  try {
    outlet.classList.add("loading");
    const node = await viewPromise;
    outlet.classList.remove("loading");
    mount(outlet, node);
    outlet.scrollTo?.({ top: 0, behavior: "instant" as ScrollBehavior });
    highlightActive();
  } catch (e) {
    outlet.classList.remove("loading");
    mount(outlet, errorNode((e as Error).message));
    toast((e as Error).message, "error");
  }
}

function errorNode(msg: string): HTMLElement {
  const d = document.createElement("div");
  d.className = "page";
  d.innerHTML = `<section class="panel"><h2>Error</h2><p class="muted">${msg}</p></section>`;
  return d;
}

router.onNavigate(() => {
  disposeAll();
});

router.route("/", () => renderInto(Dashboard()));
router.route("/explorer", () => renderInto(Explorer()));
router.route("/block/:h", (p) => renderInto(Block(p as { h: string })));
router.route("/account/:id", (p) => renderInto(Account(p as { id: string })));
router.route("/validators", () => renderInto(Validators()));
router.route("/validator/:addr", (p) => renderInto(Validator(p as { addr: string })));
router.route("/staking", () => renderInto(Staking()));
router.route("/portfolio", () => renderInto(Portfolio()));
router.route("/send", () => renderInto(Send()));
router.route("/governance", () => renderInto(Governance()));
router.route("/settings", () => renderInto(Settings()));

router.fallback(() => renderInto(Dashboard()));

router.start();

const modal = new URLSearchParams(location.search).get("modal");
if (modal === "wallet") document.dispatchEvent(new CustomEvent("hub:open-wallet"));
else if (modal === "search") document.dispatchEvent(new CustomEvent("hub:open-search"));

// Re-render on wallet change for views that depend on it.
let last: string | null = null;
wallet.onChange(() => {
  const path = location.hash.slice(1) || "/";
  if (path === last) return;
  last = path;
  // Force re-dispatch by triggering hashchange.
  const h = location.hash;
  location.hash = "";
  location.hash = h;
});
