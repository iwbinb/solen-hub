import { el, on } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc, type ValidatorInfo } from "../rpc.js";
import * as store from "../store.js";
import { fmtSolen, shortHex, bpsPct } from "../format.js";
import { identicon } from "../identicon.js";
import { go } from "../router.js";

type SortKey = "total" | "commission" | "decentral";

export async function render(): Promise<HTMLElement> {
  const root = el("div", { class: "page" });
  root.append(el("h1", null, t("validators.title")));

  const controls = el("div", { class: "row controls" });
  const sortSelect = el("select", { class: "input" }) as HTMLSelectElement;
  sortSelect.append(
    new Option(t("validators.sort.decentral"), "decentral"),
    new Option(t("validators.sort.total"), "total"),
    new Option(t("validators.sort.commission"), "commission"),
  );
  const refreshBtn = el("button", { class: "btn-ghost sm" }, t("common.refresh"));
  controls.append(el("label", { class: "lbl-inline" }, [t("common.view"), ": "]), sortSelect, refreshBtn);

  const panel = el("section", { class: "panel" });
  const count = el("span", { class: "muted small" }, "");
  panel.append(el("div", { class: "panel-head" }, [el("h2", null, t("validators.title")), count]));
  const listWrap = el("div", { class: "validator-list" });
  panel.append(listWrap);

  root.append(controls, panel);

  let cached: ValidatorInfo[] = [];
  let totalStake = 0n;

  function paint() {
    const sortKey = sortSelect.value as SortKey;
    const list = [...cached];
    if (sortKey === "total") list.sort((a, b) => cmpBig(b.total_stake, a.total_stake));
    else if (sortKey === "commission") list.sort((a, b) => a.commission_bps - b.commission_bps);
    else {
      // decentralization: penalize large stake, reward low commission
      list.sort((a, b) => {
        const score = (v: ValidatorInfo) =>
          Number(BigInt(v.total_stake) / 100_000_000n) + v.commission_bps * 10;
        return score(a) - score(b);
      });
    }

    listWrap.innerHTML = "";
    count.textContent = `(${list.length})`;
    if (!list.length) {
      listWrap.append(el("p", { class: "muted" }, t("common.empty")));
      return;
    }
    for (const v of list) listWrap.append(validatorCard(v, totalStake));
  }

  async function refresh() {
    listWrap.innerHTML = "";
    listWrap.append(el("p", { class: "muted" }, t("common.loading")));
    try {
      const rpc = getRpc(store.get("rpcUrl"));
      cached = await rpc.getValidators();
      totalStake = cached.reduce((s, v) => s + BigInt(v.total_stake), 0n);
      paint();
    } catch (e) {
      listWrap.innerHTML = "";
      listWrap.append(el("p", { class: "muted" }, (e as Error).message));
    }
  }

  sortSelect.addEventListener("change", paint);
  on(refreshBtn, "click", refresh);
  await refresh();
  return root;
}

function validatorCard(v: ValidatorInfo, total: bigint): HTMLElement {
  const pct = total > 0n ? Number((BigInt(v.total_stake) * 10000n) / total) / 100 : 0;
  const card = el("div", { class: "vc" });
  const ic = el("div", { class: "vc-ic", html: identicon(v.address, 40) });
  const main = el("div", { class: "vc-main" }, [
    el("div", { class: "vc-name" }, [
      el("code", null, shortHex(v.address, 10, 6)),
      v.is_active
        ? el("span", { class: "pill on sm" }, t("validators.active"))
        : el("span", { class: "pill off sm" }, t("validators.inactive")),
      v.is_genesis ? el("span", { class: "pill gen sm" }, t("validators.genesis")) : null,
    ]),
    el("div", { class: "vc-row muted small" }, [
      `${t("validators.total_stake")}: ${fmtSolen(v.total_stake)} SOLEN`,
      ` · ${t("validators.self_stake")}: ${fmtSolen(v.self_stake)}`,
      ` · ${t("validators.commission")}: ${bpsPct(v.commission_bps)}`,
      ` · ${pct.toFixed(2)}% ${t("validator.share")}`,
    ]),
  ]);
  const actions = el("div", { class: "vc-actions" }, [
    (() => {
      const b = el("button", { class: "btn-primary sm" }, t("validators.action.delegate"));
      on(b, "click", (e) => {
        e.stopPropagation();
        location.hash = `#/staking?v=${v.address}`;
      });
      return b;
    })(),
  ]);
  card.append(ic, main, actions);
  on(card, "click", () => go(`/validator/${v.address}`));
  return card;
}

function cmpBig(a: string, b: string): number {
  const x = BigInt(a), y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
