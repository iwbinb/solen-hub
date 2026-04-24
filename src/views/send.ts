import { el, on } from "../dom.js";
import { t } from "../i18n.js";
import { getRpc } from "../rpc.js";
import * as store from "../store.js";
import * as wallet from "../wallet.js";
import * as book from "../addressbook.js";
import { fmtSolen, parseSolen, shortHex, isHex32, normalizeAddr } from "../format.js";
import { buildCallOp, signOp } from "../ops.js";
import { toast } from "../toast.js";

export async function render(): Promise<HTMLElement> {
  const root = el("div", { class: "page" });
  root.append(el("h1", null, t("send.title")));

  if (!wallet.canSign()) {
    root.append(
      el("section", { class: "panel" }, [
        el("p", { class: "muted" }, t("common.sign_to_continue")),
        (() => {
          const b = el("button", { class: "btn-primary" }, t("wallet.connect"));
          on(b, "click", () => document.dispatchEvent(new CustomEvent("hub:open-wallet")));
          return b;
        })(),
      ]),
    );
    return root;
  }

  const panel = el("section", { class: "panel send-form" });
  const toInput = el("input", { class: "input wide", placeholder: "hex32 recipient" }) as HTMLInputElement;
  const amtInput = el("input", { class: "input", type: "number", step: "0.00000001" }) as HTMLInputElement;
  const memoInput = el("input", { class: "input", placeholder: t("common.optional") }) as HTMLInputElement;

  const abSelect = el("select", { class: "input" }) as HTMLSelectElement;
  abSelect.append(new Option(`— ${t("send.address_book")} —`, ""));
  for (const e of book.entries()) {
    abSelect.append(new Option(`${e.label} · ${shortHex(e.address)}`, e.address));
  }
  abSelect.addEventListener("change", () => {
    if (abSelect.value) toInput.value = abSelect.value;
  });

  const preview = el("div", { class: "preview muted" }, t("common.empty"));
  const simBtn = el("button", { class: "btn-secondary" }, t("common.simulate"));
  const sendBtn = el("button", { class: "btn-primary" }, t("common.submit"));
  (sendBtn as HTMLButtonElement).disabled = true;
  const warnBox = el("div", { class: "warn-box" }, "");

  panel.append(
    el("div", { class: "row form" }, [
      el("label", null, [t("send.to"), toInput]),
      el("label", null, [t("send.address_book"), abSelect]),
    ]),
    el("div", { class: "row form" }, [
      el("label", null, [t("send.amount"), amtInput]),
      el("label", null, [t("send.memo"), memoInput]),
    ]),
    warnBox,
    preview,
    el("div", { class: "row actions" }, [simBtn, sendBtn]),
  );
  root.append(panel);

  toInput.addEventListener("input", validate);
  amtInput.addEventListener("input", validate);

  function validate() {
    warnBox.textContent = "";
    warnBox.classList.remove("show");
    const v = toInput.value.trim().replace(/^0x/, "");
    if (v && !isHex32(v)) {
      warnBox.textContent = "⚠ " + t("send.warn_format");
      warnBox.classList.add("show");
      return;
    }
    if (v && normalizeAddr(v) === wallet.accountId()) {
      warnBox.textContent = "⚠ " + t("send.warn_self");
      warnBox.classList.add("show");
    }
    (sendBtn as HTMLButtonElement).disabled = true;
  }

  on(simBtn, "click", async () => {
    const rpc = getRpc(store.get("rpcUrl"));
    const s = wallet.signer()!;
    const to = normalizeAddr(toInput.value);
    if (!isHex32(to)) {
      toast(t("send.warn_format"), "warn");
      return;
    }
    const amt = parseSolen(amtInput.value);
    if (amt <= 0n) {
      toast(t("error.amount"), "warn");
      return;
    }
    preview.textContent = t("common.loading");
    try {
      const op = await buildCallOp(rpc, s, to, { method: "__transfer__", args: new Uint8Array() }, { value: amt });
      // rebuild as pure transfer (no Call action)
      op.actions = [{ Transfer: { to, amount: Number(amt) } }];
      const signed = await signOp(s, op);
      const sim = (await rpc.client.simulateOperation(signed)) as unknown as {
        success: boolean;
        error: string | null;
        gas_used: number;
      };
      if (sim.success) {
        preview.classList.remove("muted");
        preview.textContent = `✓ ${t("common.success")} · ${t("send.est_fee")}: ${sim.gas_used}`;
        (sendBtn as HTMLButtonElement).disabled = false;
      } else {
        preview.textContent = `✗ ${sim.error ?? "?"}`;
        (sendBtn as HTMLButtonElement).disabled = true;
      }
    } catch (e) {
      preview.textContent = `✗ ${(e as Error).message}`;
    }
  });

  on(sendBtn, "click", async () => {
    const rpc = getRpc(store.get("rpcUrl"));
    const s = wallet.signer()!;
    const to = normalizeAddr(toInput.value);
    const amt = parseSolen(amtInput.value);
    try {
      const op = await buildCallOp(rpc, s, to, { method: "__transfer__", args: new Uint8Array() }, { value: amt });
      op.actions = [{ Transfer: { to, amount: Number(amt) } }];
      const signed = await signOp(s, op);
      const r = (await rpc.client.submitOperation(signed)) as unknown as {
        accepted: boolean;
        error: string | null;
      };
      if (r.accepted) {
        toast(t("send.success"), "ok");
        amtInput.value = "";
        memoInput.value = "";
      } else {
        toast(r.error ?? t("common.error"), "error");
      }
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });

  return root;
}
