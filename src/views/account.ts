import { el, on } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc } from "../rpc.js";
import * as store from "../store.js";
import * as book from "../addressbook.js";
import { fmtSolen, shortHex, isHex32, normalizeAddr } from "../format.js";
import { identicon } from "../identicon.js";
import { copy } from "../toast.js";
import { go } from "../router.js";

export async function render(params: { id: string }): Promise<HTMLElement> {
  const id = normalizeAddr(params.id);
  const root = el("div", { class: "page account" });
  if (!isHex32(id)) {
    root.append(el("p", { class: "muted" }, t("error.invalid_addr")));
    return root;
  }

  const existing = book.find(id);
  const header = el("section", { class: "panel acct-hero" });
  header.append(
    el("div", { class: "acct-ic", html: identicon(id, 52) }),
    (() => {
      const info = el("div", { class: "acct-info" });
      info.append(
        el("div", { class: "acct-label" }, existing?.label ?? t("account.title")),
        el("code", { class: "acct-addr" }, shortHex(id, 12, 8)),
      );
      return info;
    })(),
    (() => {
      const actions = el("div", { class: "acct-actions" });
      const copyBtn = el("button", { class: "btn-ghost sm" }, t("account.actions.copy_addr"));
      on(copyBtn, "click", () => copy(id, t("toast.copied")));
      const bookBtn = el(
        "button",
        { class: "btn-ghost sm" },
        existing ? "✓ " + t("account.actions.add_book") : t("account.actions.add_book"),
      );
      on(bookBtn, "click", () => {
        const label = prompt(t("settings.ab_label") + ":", existing?.label ?? shortHex(id));
        if (label === null) return;
        book.upsert({ address: id, label: label || shortHex(id), kind: "other" });
        bookBtn.textContent = "✓ " + t("account.actions.add_book");
      });
      const stakeBtn = el("button", { class: "btn-primary sm" }, t("account.actions.view_stake"));
      on(stakeBtn, "click", () => go(`/validator/${id}`));
      actions.append(copyBtn, bookBtn, stakeBtn);
      return actions;
    })(),
  );

  const stats = el("div", { class: "stat-grid" });
  const delegationsPanel = el("section", { class: "panel" });
  delegationsPanel.append(el("h2", null, t("account.staking_info")));
  const delegationsBody = el("div");
  delegationsPanel.append(delegationsBody);

  root.append(header, stats, delegationsPanel);

  try {
    const rpc = getRpc(store.get("rpcUrl"));
    const [acct, staking] = await Promise.all([
      rpc.getAccount(id).catch(() => null),
      rpc.getStakingInfo(id).catch(() => null),
    ]);

    stats.append(
      statCard(t("account.balance"), acct ? `${fmtSolen(acct.balance)} SOLEN` : "0"),
      statCard(t("account.nonce"), String(acct?.nonce ?? 0)),
      statCard(t("account.staked"), acct ? `${fmtSolen(acct.staked)} SOLEN` : "0"),
      statCard(
        t("staking.delegations"),
        staking ? String(staking.delegations.length) : "0",
      ),
    );

    delegationsBody.innerHTML = "";
    if (staking && staking.delegations.length) {
      const tbl = el("table", { class: "tbl" });
      tbl.append(
        el("thead", null, [
          el("tr", null, [
            el("th", null, t("staking.validator")),
            el("th", null, t("common.amount")),
            el("th", null, ""),
          ]),
        ]),
      );
      const tb = el("tbody");
      for (const d of staking.delegations) {
        const tr = el("tr", { class: "linkable" }, [
          el("td", null, [el("code", null, shortHex(d.validator, 10, 6))]),
          el("td", null, `${fmtSolen(d.amount)} SOLEN`),
          el("td", null, "›"),
        ]);
        on(tr, "click", () => go(`/validator/${d.validator}`));
        tb.append(tr);
      }
      tbl.append(tb);
      delegationsBody.append(tbl);
    } else {
      delegationsBody.append(el("p", { class: "muted" }, t("common.empty")));
    }
  } catch (e) {
    delegationsBody.append(el("p", { class: "muted" }, (e as Error).message));
  }

  return root;
}

function statCard(k: string, v: string): HTMLElement {
  return el("div", { class: "stat" }, [
    el("div", { class: "k" }, k),
    el("div", { class: "v" }, v),
  ]);
}
