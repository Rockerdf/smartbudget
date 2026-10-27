/**
 * PROTOTYPE ONLY — Simulated bank connection for demonstration.
 * No real bank, payment network, or aggregator is contacted.
 * No credentials are requested or stored.
 */

import { useEffect, useState } from "react";
import {
  DEMO_ACCOUNT,
  isDemoTransaction,
} from "../lib/demoBank";
import { importDemoTransactions, removeDemoTransactions } from "../lib/demoBankActions";
import { fetchTransactions } from "../lib/transactions";
import type { ConnectedAccount } from "../App";

type Props = {
  alreadyConnected: boolean;
  onComplete: (accounts: ConnectedAccount[]) => void;
  onSkip: () => void;
  onDisconnect: () => void;
};

function DemoBanner() {
  return (
    <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl px-4 py-3 mb-6 flex items-start gap-2.5">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="text-xs text-[#92400E] leading-relaxed">
        <strong>Demo bank connection — simulated, not a real bank.</strong> Nothing is sent to a financial institution. No login details are collected.
      </p>
    </div>
  );
}

function AccountCard() {
  const balance = DEMO_ACCOUNT.sampleBalance.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#B45309] mb-1">Sample account</p>
          <p className="text-sm font-semibold text-[#0F172A]">{DEMO_ACCOUNT.name}</p>
          <p className="text-xs text-[#64748B] mt-0.5">
            {DEMO_ACCOUNT.bank} · {DEMO_ACCOUNT.type} ••{DEMO_ACCOUNT.last4}
          </p>
        </div>
        <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded-full shrink-0">Demo</span>
      </div>
      <p className="text-lg font-bold font-mono text-[#0F172A] mt-3">{balance}</p>
      <p className="text-[11px] text-[#94A3B8]">Sample balance for this prototype — not a live figure</p>
    </div>
  );
}

export default function BankConnect({ alreadyConnected, onComplete, onSkip, onDisconnect }: Props) {
  const [connected, setConnected] = useState(alreadyConnected);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [imported, setImported] = useState(false);

  useEffect(() => {
    setConnected(alreadyConnected);
  }, [alreadyConnected]);

  useEffect(() => {
    if (!alreadyConnected) return;
    let cancelled = false;
    fetchTransactions()
      .then((rows) => {
        if (!cancelled) setImported(rows.some(isDemoTransaction));
      })
      .catch(() => {
        /* import status is optional */
      });
    return () => {
      cancelled = true;
    };
  }, [alreadyConnected]);

  const handleSimulate = () => {
    setError("");
    setMessage("");
    onComplete([{ ...DEMO_ACCOUNT }]);
    setConnected(true);
  };

  const handleImport = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await importDemoTransactions();
      setImported(true);
      if (result.imported === 0) {
        setMessage("Demo transactions are already imported. No duplicates were added.");
      } else if (result.skipped > 0) {
        setMessage(`Imported ${result.imported} missing demo transaction${result.imported === 1 ? "" : "s"}. Existing demo rows were left unchanged.`);
      } else {
        setMessage(`Imported ${result.imported} labelled demo transactions.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import demo transactions.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const removed = await removeDemoTransactions();
      onDisconnect();
      setConnected(false);
      setImported(false);
      setMessage(
        removed > 0
          ? `Demo bank disconnected. Removed ${removed} sample transaction${removed === 1 ? "" : "s"}. Your own transactions were not deleted.`
          : "Demo bank disconnected. Your own transactions were not deleted."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect the demo bank.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-['Inter']">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl p-8 border border-[#E2E8F0] card-shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#0F172A] mb-2">
            {connected ? "Demo bank connected" : "Connect a demo bank account"}
          </h1>
          <p className="text-[#64748B] text-sm leading-relaxed mb-5">
            {connected
              ? "This is a fictional Harbour Demo Bank account. Import sample rows, or disconnect without affecting transactions you entered yourself."
              : "Preview how a bank link might look. This simulation does not contact a real bank and does not ask for a username or password."}
          </p>

          <DemoBanner />

          {error && (
            <p className="text-sm text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2 mb-4">{error}</p>
          )}
          {message && (
            <p className="text-sm text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-2 mb-4">{message}</p>
          )}

          {!connected ? (
            <div className="space-y-2.5">
              <AccountCard />
              <button
                type="button"
                onClick={handleSimulate}
                className="w-full bg-[#2563EB] text-white font-semibold py-3 rounded-xl hover:bg-[#1D4ED8] transition-all hover:shadow-lg hover:shadow-blue-200 active:scale-[.98]"
              >
                Simulate connection
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="w-full text-[#64748B] font-medium py-2.5 rounded-xl hover:bg-[#F1F5F9] transition-colors text-sm"
              >
                Skip for now — I'll enter transactions manually
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <AccountCard />
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={busy}
                className="w-full bg-[#2563EB] text-white font-semibold py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Working…" : imported ? "Import demo transactions (already added)" : "Import demo transactions"}
              </button>
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                disabled={busy}
                className="w-full text-[#EF4444] font-medium py-2.5 rounded-xl hover:bg-[#FEF2F2] transition-colors text-sm disabled:opacity-50"
              >
                Disconnect demo bank
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="w-full text-[#64748B] font-medium py-2.5 rounded-xl hover:bg-[#F1F5F9] transition-colors text-sm"
              >
                Go to dashboard →
              </button>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-[#94A3B8] mt-4">
          You can also manage this demo connection in Settings › Accounts.
        </p>
      </div>
    </div>
  );
}
