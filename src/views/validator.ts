import { el, on } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc } from "../rpc.js";
import * as store from "../store.js";
import { fmtSolen, shortHex, bpsPct, normalizeAddr, isHex32 } from "../format.js";
import { identicon } from "../identicon.js";
import { go } from "../router.js";
import { copy } from "../toast.js";

export async function render(params: { addr: string }): Promise<HTMLElement> {
  const addr = normalizeAddr(params.addr);
  const root = el("div", { class: "page" });
  root.append(
    el("div", { class: "crumb" }, [el("a", { href: "#/validators" }, "← " + t("validators.title"))]),
  );

  if (!isHex32(addr)) {
    root.append(el("p", { class: "muted" }, t("error.invalid_addr")));
    return root;
  }

  const hero = el("section", { class: "panel acct-hero" });
  hero.append(
    el("div", { class: "acct-ic", html: identicon(addr, 56) }),
    (() => {
      const info = el("div", { class: "acct-info" });
      info.append(
        el("div", { class: "acct-label" }, t("validator.title")),
        el("code", { class: "acct-addr" }, shortHex(addr, 12, 8)),
      );
      return info;
    })(),
    (() => {
      const actions = el("div", { class: "acct-actions" });
      const copyBtn = el("button", { class: "btn-ghost sm" }, t("account.actions.copy_addr"));
      on(copyBtn, "click", () => copy(addr, t("toast.copied")));
      const delegateBtn = el("button", { class: "btn-primary sm" }, t("validators.action.delegate"));
      on(delegateBtn, "click", () => (location.hash = `#/staking?v=${addr}`));
      actions.append(copyBtn, delegateBtn);
      return actions;
    })(),
  );
  root.append(hero);

  const stats = el("div", { class: "stat-grid" });
  const tip = el(
    "div",
    { class: "hint tip" },
    "💡 " + t("validator.tip"),
  );
  root.append(stats, tip);

  try {
    const rpc = getRpc(store.get("rpcUrl"));
    const all = await rpc.getValidators();
    const v = all.find((x) => normalizeAddr(x.address) === addr);
    if (!v) {
      stats.append(el("p", { class: "muted" }, t("common.empty")));
      return root;
    }
    const total = all.reduce((s, x) => s + BigInt(x.total_stake), 0n);
    const share = total > 0n ? Number((BigInt(v.total_stake) * 10000n) / total) / 100 : 0;

    stats.append(
      card(t("validators.total_stake"), `${fmtSolen(v.total_stake)} SOLEN`),
      card(t("validators.self_stake"), fmtSolen(v.self_stake)),
      card(t("validators.delegated"), fmtSolen(v.total_delegated)),
      card(t("validators.commission"), bpsPct(v.commission_bps)),
      card(
        t("validators.status"),
        v.is_active ? t("validators.active") : t("validators.inactive"),
      ),
      card(t("validator.share"), `${share.toFixed(2)}%`),
    );

    const acctLink = el("div", { class: "row" }, [
      (() => {
        const b = el("button", { class: "btn-ghost sm" }, t("common.view") + " · " + t("account.title"));
        on(b, "click", () => go(`/account/${addr}`));
        return b;
      })(),
    ]);
    root.append(acctLink);
  } catch (e) {
    stats.append(el("p", { class: "muted" }, (e as Error).message));
  }

  return root;
}

function card(k: string, v: string): HTMLElement {
  return el("div", { class: "stat" }, [
    el("div", { class: "k" }, k),
    el("div", { class: "v" }, v),
  ]);
}
