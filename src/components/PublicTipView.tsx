import React, { useState, useEffect } from "react";
import { User, ShieldCheck, CreditCard, Sparkles, Building, CheckCircle2, Ticket, ChevronRight } from "lucide-react";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Worker, Tip } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface PublicTipViewProps {
  workerId: string;
}

export default function PublicTipView({ workerId }: PublicTipViewProps) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [customAmount, setCustomAmount] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(50);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Manual / Recovery subaccount form states
  const [manualName, setManualName] = useState("");
  const [manualSubaccount, setManualSubaccount] = useState("");

  // Modals / Status Check
  const [showMockPaystack, setShowMockPaystack] = useState(false);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [tipSuccess, setTipSuccess] = useState<Tip | null>(null);

  // Paystack Keys
  const publicKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY || "";

  // Dynamic presets in ZAR
  const presets = [20, 50, 100, 200];

  // Fetch Worker Details
  useEffect(() => {
    async function fetchWorker() {
      try {
        // Check if the workerId itself is directly a Paystack subaccount code
        if (workerId && workerId.trim().startsWith("ACCT_")) {
          const directWorker: Worker = {
            id: workerId.trim(),
            employerId: "independent",
            name: "Appreciated Partner",
            position: "Staff Portfolio",
            bankName: "Settlement Bank",
            bankCode: "",
            accountNumber: "",
            accountName: "APPRECIATED PARTNER",
            subaccountCode: workerId.trim(),
            createdAt: new Date().toISOString(),
          };
          setWorker(directWorker);
          setLoading(false);
          return;
        }

        // Try looking in the URL search parameters first for high-reliability, zero-latency direct checkout
        try {
          const params = new URLSearchParams(window.location.search);
          const nameParam = params.get("name") || params.get("workerName") || "";
          const subParam = params.get("sub") || params.get("subaccount") || params.get("subaccountCode") || "";
          const posParam = params.get("pos") || params.get("position") || params.get("posParam");
          const empParam = params.get("emp") || params.get("employerId") || "independent";
          const empNameParam = params.get("empName") || params.get("employerName") || "";

          // If we have a subaccount in URL, we can immediately bypass database queries for instant checkout!
          if (subParam && subParam.trim().startsWith("ACCT_")) {
            const decodedName = nameParam ? decodeURIComponent(nameParam).trim() : "Appreciated Partner";
            const directWorker: Worker = {
              id: workerId,
              employerId: empParam,
              name: decodedName,
              position: posParam ? decodeURIComponent(posParam).trim() : "Independent Partner",
              bankName: params.get("bankName") || "Settlement Bank",
              bankCode: params.get("bankCode") || "",
              accountNumber: params.get("accountNumber") || "",
              accountName: params.get("accountName") || decodedName.toUpperCase(),
              subaccountCode: decodeURIComponent(subParam).trim(),
              createdAt: new Date().toISOString(),
            };
            if (empNameParam) {
              directWorker.employerName = decodeURIComponent(empNameParam).trim();
            }
            setWorker(directWorker);
            setLoading(false);
            return;
          }
        } catch (urlErr) {
          console.error("URL-based profile parsing failed:", urlErr);
        }

        // Try looking in local storage second for high-reliability in sandbox/demo testing
        try {
          const savedStr = localStorage.getItem("tipping_platform_workers");
          if (savedStr) {
            const allWorkers: Worker[] = JSON.parse(savedStr);
            const found = allWorkers.find((w) => w.id === workerId);
            if (found) {
              setWorker(found);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error("Local storage worker retrieve failed:", e);
        }

        // Try looking in the Firestore cloud database last
        if (workerId && workerId !== "null" && workerId !== "undefined") {
          const workerDoc = await getDoc(doc(db, "workers", workerId));
          if (workerDoc.exists()) {
            setWorker({ id: workerDoc.id, ...workerDoc.data() } as Worker);
          } else {
            setError("Worker profile matching this code could not be verified on the register.");
          }
        } else {
          setError("No worker code was provided in the scanning link.");
        }
      } catch (err) {
        console.error("Error retrieving worker:", err);
        setError("Network error loading digital tip page. Try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchWorker();
  }, [workerId]);

  // Inject Paystack script automatically
  useEffect(() => {
    if (publicKey && publicKey !== "") {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      document.body.appendChild(script);
      return () => {
        try {
          document.body.removeChild(script);
        } catch (e) {}
      };
    }
  }, [publicKey]);

  // Computes Tip Splits (98% worker / 2% split platform fee)
  const getSelectedAmount = (): number => {
    if (selectedPreset !== null) return selectedPreset;
    const custom = parseFloat(customAmount);
    return isNaN(custom) || custom <= 0 ? 0 : custom;
  };

  const amount = getSelectedAmount();
  const feeAmount = parseFloat((amount * 0.02).toFixed(2));
  const workerAmount = parseFloat((amount * 0.98).toFixed(2));

  // Handle Preset Clicks
  const selectPresetValue = (val: number) => {
    setSelectedPreset(val);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedPreset(null);
    setCustomAmount(e.target.value);
  };

  // Process tip click
  const handleInitiateTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert("Please enter or select a valid tip amount.");
      return;
    }
    if (!customerEmail || !customerEmail.includes("@")) {
      alert("Please enter a valid customer email.");
      return;
    }
    if (!worker) return;

    setSubmitting(true);

    // Generate unique reference ID
    const refId = `T_REF_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
    setPendingRef(refId);

    // 1. Save Pending record in Firestore
    const pendingTip: any = {
      id: refId,
      workerId: worker.id,
      workerName: worker.name,
      employerId: worker.employerId,
      amount: amount,
      feeAmount: feeAmount,
      workerAmount: workerAmount,
      status: "pending",
      reference: refId,
      customerEmail: customerEmail,
      createdAt: new Date().toISOString(), // rules will look for request.time, so serverTimestamp is also ideal
    };

    if (customerName.trim() !== "") {
      pendingTip.customerName = customerName.trim();
    }

    try {
      // Create pending document with exact timestamp verification
      // To satisfy rules (createdAt == request.time), we map serverTimestamp on server side.
      // In firestore client sdk, passing a JS date string doesn't equal request.time exactly unless rule allows format.
      // Oh! To satisfy `incoming().createdAt == request.time` in firestore rules, we MUST use Firestore native `serverTimestamp()`!
      // Let's call setDoc using serverTimestamp for complete compliance!
      const tipToStore = {
        ...pendingTip,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "tips", refId), tipToStore);
    } catch (err) {
      console.error("Firestore Tip pending write error:", err);
      setSubmitting(false);
      alert("Relational validation failed. Could not prepare transaction ledger.");
      return;
    }

    // 2. Trigger Payment Gateway
    // Check if we use a real key and Paystack script is alive
    const hasRealKey = publicKey && publicKey !== "" && !publicKey.includes("dummy");
    const paystackAlive = (window as any).PaystackPop;

    if (hasRealKey && paystackAlive) {
      try {
        const handler = (window as any).PaystackPop.setup({
          key: publicKey,
          email: customerEmail,
          amount: Math.round(amount * 100), // convert to cents (ZAR)
          currency: "ZAR",
          ref: refId,
          subaccount: worker.subaccountCode, // automatical split processed natively by Paystack!
          bearer: "subaccount", // subaccount bears any merchant charges as required
          callback: async (response: any) => {
            console.log("[Paystack Success Callback]:", response);
            await completePaymentFlow(refId, response.reference || refId);
          },
          onClose: () => {
            console.log("[Paystack Checkout Closed]");
            setSubmitting(false);
          },
        });
        handler.openIframe();
      } catch (err) {
        console.error("Failed to launch Paystack Inline Pop:", err);
        // Fallback to simulated mode
        setShowMockPaystack(true);
      }
    } else {
      // Key is not configured (or sandbox testing in AI Studio). Pop the beautiful mock payment modal!
      setTimeout(() => {
        setSubmitting(false);
        setShowMockPaystack(true);
      }, 800);
    }
  };

  // Complete Payment Flow (Success / Failure Updates)
  const completePaymentFlow = async (refId: string, paystackRef: string) => {
    try {
      setSubmitting(true);
      const tipDocRef = doc(db, "tips", refId);
      
      // Update the ledger with successful status and reference!
      await updateDoc(tipDocRef, {
        status: "success",
        reference: paystackRef,
      });

      // Fetch the updated document to confirm visual feedback
      const updatedSnap = await getDoc(tipDocRef);
      if (updatedSnap.exists()) {
        const fullTip = { id: updatedSnap.id, ...updatedSnap.data() } as Tip;
        setTipSuccess(fullTip);
      }
    } catch (err) {
      console.error("Error finalizing transaction ledger:", err);
      alert("Ledger update failed. Your payment was logged but status is pending validation.");
    } finally {
      setSubmitting(false);
      setShowMockPaystack(false);
    }
  };

  // Simulation handlers for sandbox mode
  const handleSimulateSuccess = async () => {
    if (!pendingRef) return;
    const finalRefId = `MOCK_PSW_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    await completePaymentFlow(pendingRef, finalRefId);
  };

  const handleSimulateCancel = async () => {
    setSubmitting(true);
    try {
      if (pendingRef) {
        await updateDoc(doc(db, "tips", pendingRef), {
          status: "failed",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
      setShowMockPaystack(false);
      alert("Payment simulation cancelled. Tip was marked as failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-4">Consulting tipping platform register...</p>
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-2xl p-8 shadow-sm border border-slate-100 font-sans">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Ticket className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tipping Profile Unavailable</h2>
          <p className="text-xs text-slate-500 mt-1.5 mb-6">{error || "Could not retrieve staff profile details."}</p>
        </div>

        {/* Database Bypass to Take User Straight to Paystack Checkout */}
        <div className="border-t border-slate-100 pt-6 mt-2">
          <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 mb-6">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Direct Paystack Checkout
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              If you have the staff member's direct Paystack Subaccount Code, you can bypass the database registry check and open the secure tipping checkout directly below.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Staff / Recipient Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sipho Ngwenya"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-blue-500 transition duration-150 outline-none text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between">
                <span>Paystack Subaccount Code</span>
                <span className="text-[9px] text-blue-500 lowercase font-mono">starts with ACCT_</span>
              </label>
              <input
                type="text"
                placeholder="e.g. ACCT_sa1v23b4n5"
                value={manualSubaccount}
                onChange={(e) => setManualSubaccount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:bg-white focus:border-blue-500 transition duration-150 outline-none text-slate-800"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const sub = manualSubaccount.trim();
                const nm = manualName.trim();
                if (!sub || !sub.startsWith("ACCT_")) {
                  alert("Please enter a valid Paystack Subaccount Code starting with ACCT_");
                  return;
                }
                const directWorker: Worker = {
                  id: `M_ID_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                  employerId: "independent",
                  name: nm || "Appreciated Partner",
                  position: "Independent Staff Member",
                  bankName: "Settlement Bank",
                  bankCode: "",
                  accountNumber: "",
                  accountName: nm ? nm.toUpperCase() : "APPRECIATED PARTNER",
                  subaccountCode: sub,
                  createdAt: new Date().toISOString(),
                };
                setWorker(directWorker);
                setError(null);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider py-4 rounded-xl shadow-md transition duration-150 flex items-center justify-center gap-1 cursor-pointer"
            >
              Initialize Tip Checkout <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-center mt-6 pt-2">
          <a
            href="/"
            className="inline-block text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition"
          >
            Cancel & Return to Portal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4 font-sans text-slate-800">
      <AnimatePresence mode="wait">
        {!tipSuccess ? (
          <motion.div
            key="checkout-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white rounded-2xl border border-slate-150/70 shadow-sm overflow-hidden"
          >
            {/* Header banner describing the placement */}
            <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
              {/* Soft visual glow bg pattern */}
              <div className="absolute right-0 bottom-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <p className="text-[9px] uppercase tracking-wider text-blue-400 font-bold mb-1">
                Secure Split Payout
              </p>
              <h2 className="text-xl font-extrabold tracking-tight">
                Tips & Appreciation
              </h2>
              <div className="flex items-center gap-2 mt-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span>Staff Tipping Directory</span>
              </div>
            </div>

            {/* Worker Visual Profile Bio */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 border border-blue-200 text-blue-700 rounded-xl shrink-0 flex items-center justify-center font-extrabold">
                <span className="text-sm">{worker.name.charAt(0)}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">{worker.name}</h3>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-0.5">
                  {worker.position}
                </p>
              </div>
            </div>

            {/* Interactive Checkout Entry form */}
            <form onSubmit={handleInitiateTip} className="p-6 space-y-6">
              {/* Preset Selection Buttons */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-450 tracking-wider uppercase">
                  Select Tip Amount
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => selectPresetValue(preset)}
                      className={`py-3 px-1 rounded-xl font-bold text-xs transition-all border cursor-pointer uppercase tracking-wider ${
                        selectedPreset === preset
                          ? "bg-blue-600 border-blue-600 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-350 hover:bg-slate-50"
                      }`}
                    >
                      R{preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input amount fields */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-450 tracking-wider uppercase">
                  Or Enter Custom Amount (R)
                </label>
                <div className="relative rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all overflow-hidden bg-white">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-455 font-bold text-xs">R</span>
                  </div>
                  <input
                    type="number"
                    min="10"
                    max="500000"
                    placeholder="Minimal tip is R10"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    className="w-full pl-8 pr-4 py-3.5 text-slate-800 font-bold placeholder-slate-400 focus:outline-none text-xs bg-transparent"
                  />
                </div>
              </div>

              {/* Split calculation display */}
              {amount > 0 && (
                <div className="bg-slate-50 rounded-xl p-4.5 border border-slate-100 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">To Support {worker.name} (98%):</span>
                    <span className="font-bold text-slate-900 font-sans">R{workerAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">SLA Fee Split (2% platform):</span>
                    <span className="text-slate-650 font-mono font-medium">R{feeAmount.toLocaleString()}</span>
                  </div>
                  <div className="h-px bg-slate-200 flex my-1"></div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-900 uppercase tracking-wider">
                    <span>Total Charged:</span>
                    <span className="text-sm text-blue-600 font-bold font-sans">R{amount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Customer Info details credentials */}
              <div className="space-y-4">
                <div className="h-px bg-slate-200 flex my-1"></div>
                <h4 className="text-[10px] font-bold text-slate-455 tracking-wider uppercase">
                  Your Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      Name <span className="text-slate-300 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Samuel"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-lg border border-slate-200 focus:border-blue-500 p-3 text-xs font-semibold focus:outline-none transition-all shadow-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="receive-receipt@domain.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-lg border border-slate-200 focus:border-blue-500 p-3 text-xs font-semibold focus:outline-none transition-all shadow-none"
                    />
                  </div>
                </div>
              </div>

              {/* Submit payment operations action button */}
              <button
                type="submit"
                disabled={submitting || amount <= 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold p-4 rounded-xl transition duration-150 shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider text-xs"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                {submitting ? "INITIATING SECURE SPLIT..." : `Leave Tip of R${amount.toLocaleString()}`}
              </button>

              <div className="text-center text-[9px] text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-wider font-bold">
                <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                <span>Secure split payment via Paystack</span>
              </div>
            </form>
          </motion.div>
        ) : (
          /* Receipt View */
          <motion.div
            key="success-receipt"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl border border-blue-500/20 shadow-sm p-8 text-center space-y-6"
          >
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Tip Sent Successfully!
              </h1>
              <p className="text-xs text-slate-450 max-w-xs mx-auto leading-relaxed">
                Thank you! Your appreciation has been registered. The payment was autonomously split 98% / 2% split.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-105 text-left space-y-3.5 max-w-md mx-auto">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Receiver Worker:</span>
                <span className="font-bold text-slate-900">{worker.name} ({worker.position})</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Total Tip Paid:</span>
                <span className="font-bold text-slate-900 font-mono">R{tipSuccess.amount.toLocaleString()}</span>
              </div>
              <div className="h-px bg-slate-200 flex"></div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Worker Payout Split (98%):</span>
                <span className="text-emerald-600 font-bold font-mono">R{tipSuccess.workerAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">SLA Split Fee (2%):</span>
                <span className="text-slate-650 font-mono font-medium">R{tipSuccess.feeAmount.toLocaleString()}</span>
              </div>
              <div className="h-px bg-slate-200 flex"></div>

              <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono uppercase font-bold tracking-wider">
                <span>Settlement Code:</span>
                <span className="text-slate-600 break-all">{worker.subaccountCode}</span>
              </div>
              <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono uppercase font-bold tracking-wider">
                <span>Transaction Ref:</span>
                <span className="text-slate-600 break-all">{tipSuccess.reference}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setTipSuccess(null);
                  setSelectedPreset(50);
                  setCustomerEmail("");
                  setCustomerName("");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition duration-150 cursor-pointer"
              >
                Send Another Tip
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paystack Simulation Dialog portal for safe testing if key is absent */}
      <AnimatePresence>
        {showMockPaystack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full border border-slate-100 text-center relative"
            >
              <div className="absolute top-0 right-0 bg-amber-50 text-amber-700 border-l border-b border-amber-100 px-3 py-1 text-[8px] font-bold tracking-wider uppercase rounded-bl-xl rounded-tr-xl">
                Sandbox Mode
              </div>

              <div className="flex items-center justify-center gap-2 mb-2 text-slate-800 font-bold text-xs uppercase tracking-wider mt-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Paystack Simulator
              </div>
              <h3 className="text-xs text-slate-400 mb-4 font-normal max-w-xs mx-auto leading-relaxed uppercase tracking-wider">
                Authorized split of 2% platform / 98% destination staff.
              </h3>

              <div className="bg-slate-50 p-5 rounded-xl text-left text-xs mb-6 space-y-2.5 border border-slate-150">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Receiver Subaccount:</span>
                  <span className="font-bold text-slate-800 font-mono break-all">{worker.subaccountCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Worker Bank:</span>
                  <span className="font-bold text-slate-700 font-mono">{worker.bankName} - {worker.accountNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Worker Share (98%):</span>
                  <span className="font-bold text-emerald-600 font-mono">R{workerAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">SLA Fee Split (2%):</span>
                  <span className="font-bold text-slate-800 font-mono">R{feeAmount.toLocaleString()}</span>
                </div>
                <div className="h-px bg-slate-200 flex"></div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-900 font-bold">Total Authorized:</span>
                  <span className="font-bold text-blue-600 font-mono text-sm">R{amount.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleSimulateSuccess}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3.5 rounded-xl transition shadow-sm cursor-pointer text-xs uppercase tracking-wider"
                >
                  Pay (Simulate 200 SUCCESS)
                </button>
                <button
                  type="button"
                  onClick={handleSimulateCancel}
                  className="w-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-355 text-slate-700 font-bold p-3 rounded-xl transition duration-150 text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancel Authorization
                </button>
              </div>

              <div className="mt-4 text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                Verification dry-run only. No money charged.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
