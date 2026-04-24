import { el, on } from "../dom.js";
import { t, setLang, currentLang } from "../i18n.js";
import * as store from "../store.js";
import * as book from "../addressbook.js";
import { shortHex } from "../format.js";
import { copy } from "../toast.js";
import { toast } from "../toast.js";

export async function render(): Promise<HTMLElement> {
  const root = el("div", { class: "page settings" });
  root.append(el("h1", null, t("settings.title")));

  root.append(generalPanel(), securityPanel(), addressBookPanel(), aboutPanel());
  return root;
}

function generalPanel(): HTMLElement {
  const p = el("section", { class: "panel" });
  p.append(el("h2", null, t("settings.general")));

  // language
  const langSel = el("select", { class: "input" }) as HTMLSelectElement;
  langSel.append(new Option("简体中文", "zh"), new Option("English", "en"));
  langSel.value = currentLang();
  langSel.addEventListener("change", () => {
    setLang(langSel.value as "zh" | "en");
    location.reload();
  });

  // theme
  const themeSel = el("select", { class: "input" }) as HTMLSelectElement;
  themeSel.append(
    new Option(t("settings.theme.dark"), "dark"),
    new Option(t("settings.theme.light"), "light"),
    new Option(t("settings.theme.system"), "system"),
  );
  themeSel.value = store.get("theme");
  themeSel.addEventListener("change", () => store.set("theme", themeSel.value as "dark" | "light" | "system"));

  // rpc url
  const rpcInput = el("input", { class: "input wide", value: store.get("rpcUrl") }) as HTMLInputElement;
  const saveRpc = el("button", { class: "btn-ghost sm" }, t("common.save"));
  on(saveRpc, "click", () => {
    store.set("rpcUrl", rpcInput.value.trim());
    toast(t("common.success"), "ok");
  });

  p.append(
    row(t("settings.language"), langSel),
    row(t("settings.theme"), themeSel),
    row(t("settings.rpc_url"), el("div", { class: "row" }, [rpcInput, saveRpc])),
  );
  return p;
}

function securityPanel(): HTMLElement {
  const p = el("section", { class: "panel" });
  p.append(el("h2", null, t("settings.security")));

  const autoInput = el("input", { class: "input", type: "number", min: "0" }) as HTMLInputElement;
  autoInput.value = String(store.get("autoLockMinutes"));
  autoInput.addEventListener("change", () => {
    const v = Math.max(0, Math.floor(Number(autoInput.value) || 0));
    store.set("autoLockMinutes", v);
  });

  const resetBtn = el("button", { class: "btn-secondary sm" }, t("settings.reset"));
  on(resetBtn, "click", () => {
    if (confirm(t("settings.reset") + "?")) {
      store.reset();
      location.reload();
    }
  });

  p.append(row(t("settings.autolock"), autoInput), row("", resetBtn));
  return p;
}

function addressBookPanel(): HTMLElement {
  const p = el("section", { class: "panel" });
  p.append(el("h2", null, t("settings.address_book")));

  const list = el("div", { class: "ab-list" });
  function paint() {
    list.innerHTML = "";
    const entries = book.entries();
    if (!entries.length) {
      list.append(el("p", { class: "muted" }, t("settings.ab_empty")));
      return;
    }
    for (const e of entries) {
      const row = el("div", { class: "ab-row" }, [
        el("div", { class: "ab-main" }, [
          el("div", { class: "ab-label" }, e.label),
          el("code", { class: "muted small" }, shortHex(e.address, 10, 6)),
        ]),
        el("div", { class: "ab-actions" }, [
          (() => {
            const b = el("button", { class: "btn-ghost sm" }, t("wallet.copy"));
            on(b, "click", () => copy(e.address, t("toast.copied")));
            return b;
          })(),
          (() => {
            const b = el("button", { class: "btn-ghost sm" }, "×");
            on(b, "click", () => {
              book.remove(e.address);
              paint();
            });
            return b;
          })(),
        ]),
      ]);
      list.append(row);
    }
  }
  paint();

  const addBtn = el("button", { class: "btn-primary sm" }, t("settings.ab_add"));
  on(addBtn, "click", () => {
    const label = prompt(t("settings.ab_label") + ":");
    if (!label) return;
    const addr = prompt(t("settings.ab_address") + " (hex32):");
    if (!addr) return;
    try {
      book.upsert({ address: addr.trim().replace(/^0x/, ""), label, kind: "other" });
      paint();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });

  p.append(list, el("div", { class: "row" }, [addBtn]));
  return p;
}

function aboutPanel(): HTMLElement {
  const p = el("section", { class: "panel" });
  p.append(el("h2", null, t("settings.about")));
  p.append(el("p", { class: "muted small" }, t("settings.about_body")));
  return p;
}

function row(k: string, v: Node): HTMLElement {
  return el("div", { class: "setting-row" }, [
    el("div", { class: "setting-k" }, k),
    el("div", { class: "setting-v" }, [v]),
  ]);
}
