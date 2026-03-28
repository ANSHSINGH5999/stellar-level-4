import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { X, Copy, CheckCircle2, ExternalLink, Send, AlertCircle, Loader2 } from "lucide-react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { server, NETWORK_PASSPHRASE } from "../lib/stellar.js";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";

// Stellar Lab deep-link: opens the transaction signer with XDR pre-filled
function stellarLabUrl(xdr) {
  const encoded = encodeURIComponent(xdr);
  return `https://laboratory.stellar.org/#txsigner?xdr=${encoded}&network=test`;
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors flex-shrink-0 ${
        copied
          ? "bg-green-700/50 text-green-300"
          : "bg-stellar-700/60 text-gray-300 hover:bg-stellar-600/60"
      }`}
    >
      {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function XDRSigningModal({ xdr, label, onClose, onSuccess }) {
  const [signedXDR, setSignedXDR] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [qrDataUrl, setQrDataUrl]     = useState("");
  const [qrError, setQrError]         = useState(false);
  const [step, setStep]               = useState(1); // 1=copy/scan, 2=paste

  // Generate QR code pointing to Stellar Lab with XDR pre-filled
  useEffect(() => {
    const url = stellarLabUrl(xdr);
    QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: "#e2e8f0", light: "#1e1b4b" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrError(true));
  }, [xdr]);

  const submit = async () => {
    const trimmed = signedXDR.trim();
    if (!trimmed) { toast.error("Paste your signed XDR first."); return; }

    setSubmitting(true);
    const id = toast.loading("Submitting transaction…");
    try {
      const tx = StellarSdk.TransactionBuilder.fromXDR(trimmed, NETWORK_PASSPHRASE);
      const result = await server.submitTransaction(tx);
      toast.success(`${label || "Transaction"} submitted!`, { id });
      onSuccess?.(result.hash);
      onClose?.();
    } catch (err) {
      Sentry.captureException(err);
      const msg = err?.response?.data?.extras?.result_codes?.transaction || err?.message || "Submission failed";
      toast.error(msg.slice(0, 120), { id });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}
    >
      <div className="w-full sm:max-w-lg bg-stellar-900 border border-stellar-700/50 shadow-2xl rounded-t-3xl sm:rounded-2xl overflow-hidden">

        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-stellar-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stellar-800/50">
          <div>
            <h2 className="font-bold text-gray-100 text-base">Sign Transaction</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manual signing — no Freighter popup needed</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1.5 rounded-xl hover:bg-stellar-800/50 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex border-b border-stellar-800/50">
          {[
            { n: 1, label: "Get Signed XDR" },
            { n: 2, label: "Paste & Submit" },
          ].map(s => (
            <button
              key={s.n}
              onClick={() => setStep(s.n)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                step === s.n
                  ? "text-indigo-400 border-b-2 border-indigo-500"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === s.n ? "bg-indigo-600 text-white" : "bg-stellar-700 text-gray-400"
              }`}>{s.n}</span>
              {s.label}
            </button>
          ))}
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">

          {/* ── Step 1: Show XDR + QR ── */}
          {step === 1 && (
            <>
              <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2.5">
                <p className="text-xs text-amber-300 font-medium">How to sign:</p>
                <ol className="text-xs text-amber-400 mt-1 space-y-0.5 list-decimal list-inside">
                  <li>Copy XDR below OR scan QR code</li>
                  <li>Opens Stellar Lab — sign with Freighter there</li>
                  <li>Copy the signed XDR from Stellar Lab</li>
                  <li>Come back here → Paste &amp; Submit</li>
                </ol>
              </div>

              {/* XDR text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Unsigned Transaction XDR</span>
                  <CopyBtn text={xdr} />
                </div>
                <textarea
                  readOnly
                  value={xdr}
                  rows={4}
                  className="w-full bg-stellar-950/80 border border-stellar-700/30 rounded-xl px-3 py-2.5 text-xs text-gray-400 font-mono resize-none focus:outline-none"
                />
              </div>

              {/* Stellar Lab link */}
              <a
                href={stellarLabUrl(xdr)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-indigo-700/40 hover:bg-indigo-700/60 border border-indigo-600/40 text-indigo-300 text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                <ExternalLink size={14} /> Open in Stellar Lab to Sign
              </a>

              {/* QR code */}
              {qrDataUrl && !qrError && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <p className="text-xs text-gray-500">Or scan to open Stellar Lab on another device</p>
                  <div className="p-3 bg-indigo-950 rounded-2xl border border-indigo-800/40">
                    <img src={qrDataUrl} alt="Stellar Lab QR" className="w-40 h-40" />
                  </div>
                </div>
              )}
              {qrError && (
                <p className="text-xs text-gray-600 text-center">QR generation failed — use the copy button or link above.</p>
              )}

              <button
                onClick={() => setStep(2)}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2"
              >
                I've signed it → Next
              </button>
            </>
          )}

          {/* ── Step 2: Paste signed XDR + submit ── */}
          {step === 2 && (
            <>
              <div className="flex items-start gap-2 bg-stellar-800/30 border border-stellar-700/30 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400">
                  After signing in Stellar Lab, copy the <strong className="text-gray-200">Signed Transaction XDR</strong> and paste it below.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-medium uppercase tracking-wider block">
                  Paste Signed XDR
                </label>
                <textarea
                  value={signedXDR}
                  onChange={(e) => setSignedXDR(e.target.value)}
                  rows={5}
                  placeholder="AAAAAgAAAA…"
                  className="w-full bg-stellar-800/60 border border-stellar-700/40 rounded-xl px-3 py-2.5 text-xs text-gray-100 font-mono resize-none focus:outline-none focus:border-indigo-500/60 placeholder-gray-600"
                />
              </div>

              <button
                onClick={submit}
                disabled={submitting || !signedXDR.trim()}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
                  : <><Send size={14} /> Submit to Blockchain</>
                }
              </button>

              <button
                onClick={() => setStep(1)}
                className="w-full text-xs text-gray-500 hover:text-gray-300 py-1 transition-colors"
              >
                ← Back to XDR
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
