import { el } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc, type ProposalInfo } from "../rpc.js";
import * as store from "../store.js";

export async function render(): Promise<HTMLElement> {
  const root = el("div", { class: "page" });
  root.append(el("h1", null, t("governance.title")));

  const panel = el("section", { class: "panel" });
  panel.append(el("p", { class: "muted" }, t("common.loading")));
  root.append(panel);

  try {
    const rpc = getRpc(store.get("rpcUrl"));
    const proposals: ProposalInfo[] = await rpc.getProposals();
    panel.innerHTML = "";
    panel.append(el("h2", null, t("governance.proposals")));
    if (!proposals.length) {
      panel.append(el("p", { class: "muted" }, t("governance.no_proposals")));
      return root;
    }
    const grid = el("div", { class: "prop-grid" });
    for (const p of proposals) grid.append(proposalCard(p));
    panel.append(grid);
  } catch (e) {
    panel.innerHTML = "";
    panel.append(
      el("div", { class: "hint warn" }, "⚠️ " + t("governance.unavailable")),
      el("p", { class: "muted small" }, (e as Error).message),
    );
  }

  return root;
}

function proposalCard(p: ProposalInfo): HTMLElement {
  const yes = BigInt(p.yes);
  const no = BigInt(p.no);
  const total = yes + no + BigInt(p.abstain ?? "0");
  const pctYes = total > 0n ? Number((yes * 10000n) / total) / 100 : 0;

  const card = el("div", { class: "prop-card" }, [
    el("div", { class: "prop-head" }, [
      el("span", { class: "prop-id" }, `#${p.id}`),
      el("span", { class: `pill ${statusPill(p.status)} sm` }, p.status),
    ]),
    el("h3", null, p.title ?? `Proposal #${p.id}`),
    p.description ? el("p", { class: "muted small" }, p.description.slice(0, 160)) : el("div"),
    el("div", { class: "prop-bar" }, [
      el("div", { class: "prop-bar-fill", style: `width:${pctYes}%` }),
    ]),
    el("div", { class: "row muted small" }, [
      `YES ${pctYes.toFixed(1)}% · ${t("governance.active")}: ${p.end_epoch ?? "—"}`,
    ]),
  ]);
  return card;
}

function statusPill(s: string): string {
  const u = s.toLowerCase();
  if (u.includes("pass")) return "on";
  if (u.includes("reject") || u.includes("fail")) return "off";
  return "gen";
}
