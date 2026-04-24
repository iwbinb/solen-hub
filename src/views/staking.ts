import { el, on, clear } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc } from "../rpc.js";
import * as store from "../store.js";
import * as wallet from "../wallet.js";
import { STAKING_ADDRESS, stakingCalls } from "../staking.js";
import { fmtSolen, parseSolen, shortHex, isHex32 } from "../format.js";
import { simulate, submit } from "../tx.js";
import { toast } from "../toast.js";
import { go } from "../router.js";

export async function render(): Promise<HTMLElement> {
  const root = el("div", { class: "page" });
  root.append(el("h1", null, t("staking.title")));

  if (!wallet.accountId()) {
    const c = el("section", { class: "panel" });
    c.append(
      el("p", { class: "muted" }, t("dashboard.todo_connect")),
      (() => {
        const b = el("button", { class: "btn-primary" }, t("wallet.connect"));
        on(b, "click", () => document.dispatchEvent(new CustomEvent("hub:open-wallet")));
        return b;
      })(),
    );
    root.append(c);
    return root;
  }

  const acctPanel = el("section", { class: "panel" });
  acctPanel.append(el("h2", null, t("staking.my_account")));
  const acctBody = el("div", { class: "row" });
  acctPanel.append(acctBody);

  const delegationsPanel = el("section", { class: "panel" });
  delegationsPanel.append(el("h2", null, t("staking.delegations")));
  const delegationsBody = el("div");
  delegationsPanel.append(delegationsBody);

  const formPanel = buildDelegationWizard();

  root.append(acctPanel, delegationsPanel, formPanel);

  async function refresh() {
    const rpc = getRpc(store.get("rpcUrl"));
    const acct = wallet.accountId()!;
    try {
      const [info, staking] = await Promise.all([
        rpc.getAccount(acct).catch(() => null),
        rpc.getStakingInfo(acct).catch(() => ({
          total_delegated: "0",
          delegations: [],
          pending_undelegations: 0,
        })),
      ]);
      clear(acctBody);
      acctBody.append(
        rowItem(t("wallet.address"), shortHex(acct, 12, 8)),
        rowItem(t("account.balance"), `${fmtSolen(info?.balance ?? "0")} SOLEN`),
        rowItem(t("staking.delegations") + " · " + t("common.amount"), `${fmtSolen(staking.total_delegated)} SOLEN`),
        rowItem(t("staking.pending_undel"), String(staking.pending_undelegations)),
      );

      clear(delegationsBody);
      if (!staking.delegations.length) {
        delegationsBody.append(el("p", { class: "muted" }, t("staking.none_yet")));
      } else {
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
          const tr = el("tr", null, [
            el("td", null, [
              (() => {
                const a = el("a", { href: `#/validator/${d.validator}` }, shortHex(d.validator, 10, 6));
                return a;
              })(),
            ]),
            el("td", null, `${fmtSolen(d.amount)} SOLEN`),
            (() => {
              const td = el("td", { class: "act" });
              if (wallet.canSign()) {
                const btn = el("button", { class: "btn-ghost sm" }, t("staking.undelegate"));
                on(btn, "click", async () => {
                  const amt = prompt(
                    `${t("staking.undelegate")} · ${t("common.amount")} (max ${fmtSolen(d.amount)}):`,
                    fmtSolen(d.amount),
                  );
                  if (!amt) return;
                  await doUndelegate(d.validator, parseSolen(amt));
                });
                td.append(btn);
              }
              return td;
            })(),
          ]);
          tb.append(tr);
        }
        tbl.append(tb);
        delegationsBody.append(tbl);

        if (wallet.canSign() && staking.pending_undelegations > 0) {
          const wd = el("div", { class: "row" });
          const b = el("button", { class: "btn-secondary" }, t("staking.withdraw_matured"));
          on(b, "click", async () => {
            try {
              await submit(rpc, STAKING_ADDRESS, stakingCalls.withdraw());
              setTimeout(refresh, 1500);
            } catch (e) {
              toast((e as Error).message, "error");
            }
          });
          wd.append(b);
          delegationsBody.append(wd);
        }
      }
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function doUndelegate(validator: string, amt: bigint) {
    if (!wallet.canSign()) {
      toast(t("common.sign_to_continue"), "warn");
      return;
    }
    const rpc = getRpc(store.get("rpcUrl"));
    try {
      await submit(rpc, STAKING_ADDRESS, stakingCalls.undelegate(validator, amt));
      setTimeout(refresh, 1500);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  await refresh();
  return root;
}

function rowItem(k: string, v: string): HTMLElement {
  return el("div", { class: "kv-inline" }, [
    el("span", { class: "k" }, k),
    el("span", { class: "v mono" }, v),
  ]);
}

function buildDelegationWizard(): HTMLElement {
  const panel = el("section", { class: "panel wizard" });
  panel.append(el("h2", null, t("staking.new_delegation")));

  // pull ?v= from URL hash
  const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const initialV = params.get("v") ?? "";

  const form = el("div", { class: "row form" });
  const vInput = el("input", {
    class: "input wide",
    placeholder: "hex32 validator address",
    value: initialV,
  }) as HTMLInputElement;
  const amtInput = el("input", {
    class: "input",
    type: "number",
    step: "0.00000001",
    placeholder: "0.00000000",
  }) as HTMLInputElement;
  form.append(
    el("label", null, [t("staking.validator"), vInput]),
    el("label", null, [t("staking.amount"), amtInput]),
  );
  panel.append(form);

  const hint = el("div", { class: "hint" }, [
    `⏳ ${t("staking.unbond_hint", { epochs: "?", time: "?" })}`,
  ]);
  const slashHint = el("div", { class: "hint warn" }, [`⚠️ ${t("staking.slash_hint")}`]);
  panel.append(hint, slashHint);

  const actions = el("div", { class: "row actions" });
  const simBtn = el("button", { class: "btn-secondary" }, t("common.simulate"));
  const signBtn = el("button", { class: "btn-primary" }, t("staking.sign_send"));
  (signBtn as HTMLButtonElement).disabled = true;
  const statusNote = el("div", { class: "sim-note" }, "");
  actions.append(simBtn, signBtn, statusNote);
  panel.append(actions);

  function readInputs(): { v: string; amt: bigint } | null {
    const v = vInput.value.trim().replace(/^0x/, "").toLowerCase();
    if (!isHex32(v)) {
      toast(t("error.invalid_addr"), "warn");
      return null;
    }
    const amt = parseSolen(amtInput.value);
    if (amt <= 0n) {
      toast(t("error.amount"), "warn");
      return null;
    }
    return { v, amt };
  }

  on(simBtn, "click", async () => {
    if (!wallet.canSign()) {
      toast(t("common.sign_to_continue"), "warn");
      return;
    }
    const rpc = getRpc(store.get("rpcUrl"));
    const inp = readInputs();
    if (!inp) return;
    statusNote.textContent = t("common.loading");
    try {
      const r = await simulate(rpc, STAKING_ADDRESS, stakingCalls.delegate(inp.v, inp.amt), {
        value: inp.amt,
      });
      if (r.success) {
        statusNote.textContent = "✓ " + t("staking.simulate_ok", { gas: r.gas_used });
        (signBtn as HTMLButtonElement).disabled = false;
      } else {
        statusNote.textContent = "✗ " + t("staking.simulate_fail", { err: r.error ?? "?" });
        (signBtn as HTMLButtonElement).disabled = true;
      }
    } catch (e) {
      statusNote.textContent = "✗ " + (e as Error).message;
      (signBtn as HTMLButtonElement).disabled = true;
    }
  });

  on(signBtn, "click", async () => {
    const rpc = getRpc(store.get("rpcUrl"));
    const inp = readInputs();
    if (!inp) return;
    try {
      await submit(rpc, STAKING_ADDRESS, stakingCalls.delegate(inp.v, inp.amt), { value: inp.amt });
      (signBtn as HTMLButtonElement).disabled = true;
      vInput.value = "";
      amtInput.value = "";
      statusNote.textContent = "";
      setTimeout(() => go("/staking"), 500);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });

  // fetch unbonding hint
  (async () => {
    try {
      const rpc = getRpc(store.get("rpcUrl"));
      const s = await rpc.chainStatus();
      const secs = (s.config.unbonding_period_epochs * s.config.epoch_length * s.config.block_time_ms) / 1000;
      const timeStr = secs < 3600 ? `${Math.round(secs / 60)} min` : `${(secs / 3600).toFixed(1)} h`;
      hint.textContent = `⏳ ${t("staking.unbond_hint", { epochs: s.config.unbonding_period_epochs, time: timeStr })}`;
    } catch {}
  })();

  return panel;
}
