import { el, on } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc } from "../rpc.js";
import * as store from "../store.js";
import * as wallet from "../wallet.js";
import { fmtSolen, shortHex, fmtDate } from "../format.js";
import { toast } from "../toast.js";

export async function render(): Promise<HTMLElement> {
  const root = el("div", { class: "page" });
  root.append(el("h1", null, t("portfolio.title")));

  const acct = wallet.accountId();
  if (!acct) {
    root.append(
      el("section", { class: "panel" }, [
        el("p", { class: "muted" }, t("dashboard.todo_connect")),
        (() => {
          const b = el("button", { class: "btn-primary" }, t("wallet.connect"));
          on(b, "click", () => document.dispatchEvent(new CustomEvent("hub:open-wallet")));
          return b;
        })(),
      ]),
    );
    return root;
  }

  const summary = el("div", { class: "stat-grid" });
  const vestingPanel = el("section", { class: "panel" });
  vestingPanel.append(el("h2", null, t("portfolio.vesting")));
  const vestingBody = el("div");
  vestingPanel.append(vestingBody);

  const actionRow = el("div", { class: "row" });
  const csvBtn = el("button", { class: "btn-secondary sm" }, t("portfolio.export"));
  actionRow.append(csvBtn);

  root.append(summary, actionRow, vestingPanel);

  try {
    const rpc = getRpc(store.get("rpcUrl"));
    const [info, staking, vesting] = await Promise.all([
      rpc.getAccount(acct).catch(() => null),
      rpc.getStakingInfo(acct).catch(() => null),
      rpc.getVestingInfo(acct).catch(() => null),
    ]);

    const liquid = BigInt(info?.balance ?? "0");
    const staked = BigInt(staking?.total_delegated ?? "0");
    const vested = vesting?.schedules.reduce(
      (s, x) => s + (BigInt(x.total) - BigInt(x.released)),
      0n,
    ) ?? 0n;
    const total = liquid + staked + vested;

    summary.append(
      card(t("portfolio.total"), `${fmtSolen(total)} SOLEN`),
      card(t("portfolio.liquid"), fmtSolen(liquid)),
      card(t("portfolio.staked"), fmtSolen(staked)),
      card(t("portfolio.vesting"), fmtSolen(vested)),
    );

    vestingBody.innerHTML = "";
    if (!vesting || !vesting.schedules.length) {
      vestingBody.append(el("p", { class: "muted" }, t("portfolio.vesting_none")));
    } else {
      const tbl = el("table", { class: "tbl" });
      tbl.append(
        el("thead", null, [
          el("tr", null, [
            el("th", null, "Start"),
            el("th", null, "End"),
            el("th", null, "Total"),
            el("th", null, "Released"),
            el("th", null, "%"),
          ]),
        ]),
      );
      const tb = el("tbody");
      for (const s of vesting.schedules) {
        const pct =
          BigInt(s.total) > 0n
            ? Number((BigInt(s.released) * 10000n) / BigInt(s.total)) / 100
            : 0;
        tb.append(
          el("tr", null, [
            el("td", null, fmtDate(s.start_ms)),
            el("td", null, fmtDate(s.end_ms)),
            el("td", null, fmtSolen(s.total)),
            el("td", null, fmtSolen(s.released)),
            el("td", null, `${pct.toFixed(1)}%`),
          ]),
        );
      }
      tbl.append(tb);
      vestingBody.append(tbl);
    }

    on(csvBtn, "click", () => {
      const rows = [
        ["address", acct],
        ["liquid_base_units", liquid.toString()],
        ["staked_base_units", staked.toString()],
        ["vesting_pending_base_units", vested.toString()],
        ["total_base_units", total.toString()],
        ["exported_at", new Date().toISOString()],
      ];
      if (staking) {
        for (const d of staking.delegations) {
          rows.push([`delegation:${d.validator}`, d.amount]);
        }
      }
      const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
      downloadBlob(`solen-portfolio-${shortHex(acct, 8, 4).replace("…", "-")}.csv`, csv);
      toast(t("common.success"), "ok");
    });
  } catch (e) {
    summary.append(el("p", { class: "muted" }, (e as Error).message));
  }

  return root;
}

function card(k: string, v: string): HTMLElement {
  return el("div", { class: "stat" }, [
    el("div", { class: "k" }, k),
    el("div", { class: "v" }, v),
  ]);
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
