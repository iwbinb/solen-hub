import { el, on, clear } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc, type BlockInfo } from "../rpc.js";
import * as store from "../store.js";
import { fmtSolen, shortHex, agoMs, fmtGas } from "../format.js";
import { go } from "../router.js";
import { setInt } from "../lifecycle.js";

export async function render(): Promise<HTMLElement> {
  const root = el("div", { class: "page explorer" });
  const cards = el("div", { class: "stat-grid wide" });
  const panel = el("section", { class: "panel" });
  const head = el("div", { class: "panel-head" });
  const table = el("table", { class: "tbl blocks" });
  const thead = el("thead", null, [
    el("tr", null, [
      el("th", null, "#"),
      el("th", null, t("explorer.epoch")),
      el("th", null, t("explorer.proposer")),
      el("th", null, t("explorer.tx_count")),
      el("th", null, t("explorer.gas_used")),
      el("th", null, t("explorer.age")),
    ]),
  ]);
  const tbody = el("tbody");
  table.append(thead, tbody);

  const autoChk = el("input", { type: "checkbox", id: "auto-poll", checked: "" });
  const autoLbl = el("label", null, [autoChk, " " + t("explorer.auto")]);
  const refreshBtn = el("button", { class: "btn-ghost sm" }, t("common.refresh"));
  on(refreshBtn, "click", () => refresh());

  head.append(el("h2", null, t("explorer.recent_blocks")), autoLbl, refreshBtn);
  panel.append(head, table);
  root.append(el("h1", null, t("explorer.title")), cards, panel);

  let oldest = 0; // height at end of current list, for Load more

  async function refresh() {
    const rpc = getRpc(store.get("rpcUrl"));
    try {
      const [status, latest] = await Promise.all([rpc.chainStatus(), rpc.getLatestBlock()]);
      clear(cards);
      cards.append(
        stat(t("explorer.height"), String(status.height)),
        stat(t("explorer.epoch"), String(latest.epoch)),
        stat(t("explorer.total_staked"), fmtSolen(status.total_staked)),
        stat(t("explorer.circulation"), fmtSolen(status.total_circulation)),
        stat(t("explorer.blocktime"), `${status.config.block_time_ms}ms`),
        stat(t("explorer.pending"), String(status.pending_ops)),
      );

      const N = 20;
      const heights: number[] = [];
      for (let i = 0; i < N && latest.height - i >= 0; i++) heights.push(latest.height - i);
      oldest = heights[heights.length - 1];

      const blocks = await Promise.all(
        heights.map((h) =>
          h === latest.height ? Promise.resolve(latest) : rpc.getBlock(h).catch(() => null),
        ),
      );
      clear(tbody);
      for (const b of blocks) if (b) tbody.append(blockRow(b));

      if (!tbody.querySelector(".load-more")) {
        const tr = el("tr", { class: "load-more" }, [
          el("td", { colspan: "6" }, [
            (() => {
              const b = el("button", { class: "btn-ghost sm" }, t("explorer.load_more"));
              on(b, "click", () => loadMore());
              return b;
            })(),
          ]),
        ]);
        tbody.append(tr);
      }
    } catch (e) {
      clear(tbody);
      tbody.append(el("tr", null, [el("td", { colspan: "6", class: "muted" }, (e as Error).message)]));
    }
  }

  async function loadMore() {
    if (oldest <= 0) return;
    const rpc = getRpc(store.get("rpcUrl"));
    const heights: number[] = [];
    for (let i = 1; i <= 20 && oldest - i >= 0; i++) heights.push(oldest - i);
    const blocks = await Promise.all(heights.map((h) => rpc.getBlock(h).catch(() => null)));
    const loadMoreTr = tbody.querySelector(".load-more");
    for (const b of blocks) if (b) tbody.insertBefore(blockRow(b), loadMoreTr);
    oldest = heights[heights.length - 1] ?? oldest;
    if (oldest <= 0) loadMoreTr?.remove();
  }

  await refresh();
  setInt(() => {
    if ((autoChk as HTMLInputElement).checked) refresh();
  }, 6000);
  return root;
}

function stat(k: string, v: string): HTMLElement {
  return el("div", { class: "stat" }, [
    el("div", { class: "k" }, k),
    el("div", { class: "v" }, v),
  ]);
}

function blockRow(b: BlockInfo): HTMLElement {
  const tr = el("tr", { class: "linkable" }, [
    el("td", null, [el("code", null, `#${b.height}`)]),
    el("td", null, String(b.epoch)),
    el("td", null, [el("code", null, shortHex(b.proposer, 8, 6))]),
    el("td", null, String(b.tx_count)),
    el("td", null, fmtGas(b.gas_used)),
    el("td", { class: "muted" }, agoMs(b.timestamp_ms, t("common.just_now"))),
  ]);
  on(tr, "click", () => go(`/block/${b.height}`));
  return tr;
}
