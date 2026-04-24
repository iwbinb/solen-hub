import { el, on, clear } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc } from "../rpc.js";
import * as store from "../store.js";
import * as wallet from "../wallet.js";
import { fmtSolen, shortHex, agoMs, fmtDuration } from "../format.js";
import { go } from "../router.js";
import { setInt } from "../lifecycle.js";
import { identicon } from "../identicon.js";

export async function render(): Promise<HTMLElement> {
  const root = el("div", { class: "page dashboard" });

  const hero = el("section", { class: "hero" });
  const grid = el("div", { class: "grid-2" });
  const todoPanel = el("section", { class: "panel panel-todo" });
  const netPanel = el("section", { class: "panel" });

  root.append(hero, grid);
  grid.append(todoPanel, netPanel);

  async function refresh() {
    const rpc = getRpc(store.get("rpcUrl"));
    const acct = wallet.accountId();

    // — hero —
    clear(hero);
    if (!acct) {
      hero.append(
        el("div", { class: "hero-empty" }, [
          el("h1", null, t("dashboard.title")),
          el("p", { class: "muted" }, t("dashboard.todo_connect")),
          (() => {
            const b = el("button", { class: "btn-primary" }, t("wallet.connect"));
            on(b, "click", () => document.dispatchEvent(new CustomEvent("hub:open-wallet")));
            return b;
          })(),
        ]),
      );
    } else {
      const ic = el("div", { class: "hero-ic", html: identicon(acct, 56) });
      const info = el("div", { class: "hero-info" });
      const addrRow = el("div", { class: "hero-addr" }, [
        el("code", null, shortHex(acct, 10, 8)),
        wallet.mode() === "sign"
          ? el("span", { class: "pill on sm" }, t("wallet.mode.sign"))
          : el("span", { class: "pill gen sm" }, t("wallet.mode.watch")),
      ]);
      info.append(
        addrRow,
        el("div", { class: "hero-metrics" }, [
          el("div", { class: "metric big" }, [
            el("div", { class: "k" }, t("dashboard.net_worth")),
            el("div", { class: "v" }, "…"),
          ]),
        ]),
      );
      hero.append(ic, info);

      try {
        const [accountInfo, staking] = await Promise.all([
          rpc.getAccount(acct).catch(() => null),
          rpc.getStakingInfo(acct).catch(() => ({
            total_delegated: "0",
            delegations: [],
            pending_undelegations: 0,
          })),
        ]);
        const bal = BigInt(accountInfo?.balance ?? "0");
        const stk = BigInt(staking.total_delegated);
        const net = bal + stk;

        info.querySelector(".metric.big")?.replaceWith(
          el("div", { class: "metric big" }, [
            el("div", { class: "k" }, t("dashboard.net_worth")),
            el("div", { class: "v" }, fmtSolen(net)),
          ]),
        );
        info.append(
          el("div", { class: "hero-metrics" }, [
            metric(t("dashboard.liquid"), `${fmtSolen(bal)} SOLEN`),
            metric(t("dashboard.staked"), `${fmtSolen(stk)} SOLEN`),
            metric(t("dashboard.unbonding"), String(staking.pending_undelegations)),
          ]),
        );
      } catch (e) {
        info.append(el("p", { class: "muted" }, (e as Error).message));
      }
    }

    // — todo panel —
    clear(todoPanel);
    todoPanel.append(el("h2", null, t("dashboard.todos")));
    const todoList = el("div", { class: "todo-list" });
    todoPanel.append(todoList);
    const todos: HTMLElement[] = [];
    if (!acct) {
      todos.push(
        todoItem("→", t("dashboard.todo_connect"), () =>
          document.dispatchEvent(new CustomEvent("hub:open-wallet")),
        ),
      );
    } else {
      try {
        const staking = await rpc.getStakingInfo(acct).catch(() => null);
        if (staking && staking.pending_undelegations > 0) {
          todos.push(
            todoItem("↑", t("dashboard.todo_withdraw"), () => go("/staking")),
          );
        }
        if (staking && staking.delegations.length === 0) {
          todos.push(
            todoItem("✦", t("dashboard.start_staking"), () => go("/validators")),
          );
        }
      } catch {}
    }
    if (!todos.length) {
      todoList.append(el("p", { class: "muted" }, t("dashboard.no_todos")));
    } else {
      for (const n of todos) todoList.append(n);
    }

    // — network panel —
    clear(netPanel);
    netPanel.append(el("h2", null, t("dashboard.network")));
    const grid2 = el("div", { class: "stat-grid" });
    netPanel.append(grid2);
    try {
      const status = await rpc.chainStatus();
      const latest = await rpc.getLatestBlock();
      grid2.append(
        stat(t("explorer.height"), String(status.height)),
        stat(t("explorer.epoch"), String(latest.epoch)),
        stat(t("explorer.total_staked"), `${fmtSolen(status.total_staked)} SOLEN`),
        stat(t("explorer.circulation"), `${fmtSolen(status.total_circulation)} SOLEN`),
        stat(t("explorer.blocktime"), `${status.config.block_time_ms}ms`),
        stat(t("explorer.pending"), String(status.pending_ops)),
        stat(
          t("staking.pending_undel"),
          fmtDuration(
            (status.config.unbonding_period_epochs *
              status.config.epoch_length *
              status.config.block_time_ms) /
              1000,
          ),
        ),
        stat(t("explorer.age"), agoMs(latest.timestamp_ms, t("common.just_now"))),
      );
    } catch (e) {
      grid2.append(el("p", { class: "muted" }, (e as Error).message));
    }
  }

  await refresh();
  setInt(() => refresh(), 12_000);
  return root;
}

function metric(k: string, v: string): HTMLElement {
  return el("div", { class: "metric" }, [
    el("div", { class: "k" }, k),
    el("div", { class: "v" }, v),
  ]);
}
function stat(k: string, v: string): HTMLElement {
  return el("div", { class: "stat" }, [
    el("div", { class: "k" }, k),
    el("div", { class: "v" }, v),
  ]);
}
function todoItem(icn: string, text: string, onClick: () => void): HTMLElement {
  const n = el("div", { class: "todo-item" }, [
    el("span", { class: "todo-ic" }, icn),
    el("span", { class: "todo-text" }, text),
    el("span", { class: "todo-arrow" }, "›"),
  ]);
  on(n, "click", onClick);
  return n;
}
