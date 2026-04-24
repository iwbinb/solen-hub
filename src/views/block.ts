import { el, on } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc } from "../rpc.js";
import * as store from "../store.js";
import { shortHex, fmtGas, fmtDate } from "../format.js";
import { go } from "../router.js";
import { copy } from "../toast.js";

export async function render(params: { h: string }): Promise<HTMLElement> {
  const root = el("div", { class: "page" });
  const h = Number(params.h);
  root.append(
    el("div", { class: "crumb" }, [
      (() => {
        const a = el("a", { href: "#/explorer" }, "← " + t("nav.explorer"));
        return a;
      })(),
    ]),
    el("h1", null, `${t("block.title")} #${h}`),
  );

  const panel = el("section", { class: "panel" });
  panel.append(el("p", { class: "muted" }, t("common.loading")));
  root.append(panel);

  try {
    const rpc = getRpc(store.get("rpcUrl"));
    const b = await rpc.getBlock(h);
    panel.innerHTML = "";
    panel.append(
      kv(t("explorer.height"), String(b.height)),
      kv(t("explorer.epoch"), String(b.epoch)),
      kv(t("block.timestamp"), fmtDate(b.timestamp_ms)),
      kv(t("explorer.proposer"), b.proposer, () => copy(b.proposer, t("toast.copied"))),
      kv(t("block.parent"), b.parent_hash, () => copy(b.parent_hash, t("toast.copied"))),
      kv(t("block.state_root"), b.state_root),
      kv(t("block.tx_root"), b.transactions_root),
      kv(t("block.receipt_root"), b.receipts_root),
      kv(t("explorer.tx_count"), String(b.tx_count)),
      kv(t("block.gas"), fmtGas(b.gas_used)),
    );

    if (b.height > 0) {
      const navRow = el("div", { class: "row nav-row" });
      const prev = el("button", { class: "btn-ghost sm" }, `← #${b.height - 1}`);
      on(prev, "click", () => go(`/block/${b.height - 1}`));
      navRow.append(prev);
      panel.append(navRow);
    }
  } catch (e) {
    panel.innerHTML = "";
    panel.append(el("p", { class: "muted" }, (e as Error).message));
  }

  return root;
}

function kv(k: string, v: string, onClickVal?: () => void): HTMLElement {
  const row = el("div", { class: "kv" }, [
    el("div", { class: "kv-k" }, k),
    (() => {
      const vEl = el("div", { class: "kv-v mono" }, v);
      if (onClickVal) {
        vEl.setAttribute("role", "button");
        vEl.classList.add("copyable");
        vEl.title = t("wallet.copy");
        on(vEl, "click", onClickVal);
      }
      return vEl;
    })(),
  ]);
  return row;
}
