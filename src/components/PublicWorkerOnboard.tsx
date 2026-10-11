import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Worker, PaystackBank } from "../types";
import { 
  Building2, 
  CreditCard, 
  User, 
  Phone, 
  ShieldCheck, 
  ArrowLeft, 
  CheckCircle2, 
  QrCode, 
  Printer, 
  ExternalLink,
  ChevronRight,
  Loader2,
  Lock
} from "lucide-react";
import QrCodeCard from "./QrCodeCard";

interface PublicWorkerOnboardProps {
  onBack: () => void;
}

export function PublicWorkerOnboard({ onBack }: PublicWorkerOnboardProps) {
  // Form steps
  const [step, setStep] = useState<1 | 2>(1); // 1: Info & Bank, 2: Success & QR Code

  // Form Fields
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [cellNumber, setCellNumber] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [position, setPosition] = useState("");

  // State managers
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resulting onboarded worker
  const [createdWorker, setCreatedWorker] = useState<Worker | null>(null);

  // Fetch South African banks on load
  useEffect(() => {
    async function loadBanks() {
      setLoadingBanks(true);
      try {
        const response = await fetch("/api/paystack/banks?currency=ZAR&country=south%20africa");
        const json = await response.json();
        if (json.status && json.data) {
          setBanks(json.data);
          if (json.data.length > 0) {
            setSelectedBankCode(json.data[0].code);
          }
        }
      } catch (err) {
        console.error("Failed loading banks", err);
      } finally {
        setLoadingBanks(false);
      }
    }
    loadBanks();
  }, []);

  // Validate account when account number reaches 10 digits
  useEffect(() => {
    if (accountNumber.length >= 10 && accountNumber.length <= 13 && selectedBankCode !== "") {
      const delayDebounce = setTimeout(() => {
        resolveAccount();
      }, 600);
      return () => clearTimeout(delayDebounce);
    } else {
      setResolvedAccountName(null);
    }
  }, [accountNumber, selectedBankCode]);

  const resolveAccount = async () => {
    setResolvingAccount(true);
    setResolvedAccountName(null);
    try {
      const response = await fetch("/api/paystack/verify-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: accountNumber,
          bankCode: selectedBankCode,
        }),
      });
      const json = await response.json();
      if (json.status && json.data) {
        setResolvedAccountName(json.data.account_name);
      } else {
        setResolvedAccountName("MOCK ACCOUNT (UNVERIFIED)");
      }
    } catch (err) {
      console.error(err);
      setResolvedAccountName("MOCK ACCOUNT (UNVERIFIED)");
    } finally {
      setResolvingAccount(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !idNumber || !cellNumber || !selectedBankCode || !accountNumber) {
      setErrorMsg("Please fill in all mandatory fields correctly.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const bankObj = banks.find((b) => b.code === selectedBankCode);
    const actualBankName = bankObj ? bankObj.name : "Capitec Bank";

    try {
      // 1. Resolve employer link if employer name entered
      let linkedEmployerId = "independent";
      if (employerName.trim() !== "") {
        try {
          // Check local storage first for high-reliability sandbox demo
          try {
            const savedEmps = localStorage.getItem("tipping_platform_employers");
            if (savedEmps) {
              const emps = JSON.parse(savedEmps);
              const found = emps.find(
                (e: any) =>
                  e.businessName &&
                  e.businessName.trim().toLowerCase() === employerName.trim().toLowerCase()
              );
              if (found) {
                linkedEmployerId = found.uid || found.id;
              }
            }
          } catch (e) {
            console.error(e);
          }

          if (linkedEmployerId === "independent") {
            // Fetch users list to see if business matching
            const usersSnap = await getDocs(collection(db, "users"));
            usersSnap.forEach((userDoc) => {
              const data = userDoc.data();
              if (
                data.businessName &&
                data.businessName.trim().toLowerCase() === employerName.trim().toLowerCase()
              ) {
                linkedEmployerId = userDoc.id;
              }
            });
          }
        } catch (err) {
          console.error("Could not cross-reference employer name", err);
        }
      }

      // 2. Submit to Paystack split subaccount API
      const subRes = await fetch("/api/paystack/create-subaccount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: `${name.trim()} (${position || "Independent Partner"})`,
          settlementBank: selectedBankCode,
          accountNumber: accountNumber,
        }),
      });

      const subJson = await subRes.json();
      if (!subJson.status || !subJson.data) {
        throw new Error(subJson.message || "Failed subaccount verification. Please verify bank coordinates.");
      }

      const paystackSubaccountCode = subJson.data.subaccount_code;

      // 3. Save Worker in database
      const randomId = `W_ID_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const payload: Worker = {
        id: randomId,
        employerId: linkedEmployerId,
        name: name.trim(),
        position: position.trim() !== "" ? position.trim() : "Independent Partner",
        bankName: actualBankName,
        bankCode: selectedBankCode,
        accountNumber: accountNumber,
        accountName: resolvedAccountName || name.toUpperCase(),
        subaccountCode: paystackSubaccountCode,
        createdAt: new Date().toISOString(),
        idNumber: idNumber.trim(),
        cellNumber: cellNumber.trim(),
      };

      if (employerName.trim() !== "") {
        payload.employerName = employerName.trim();
      }

      // Always save to localStorage database copy so that dashboards update instantly
      try {
        const savedStr = localStorage.getItem("tipping_platform_workers");
        const allSaved = savedStr ? JSON.parse(savedStr) : [];
        allSaved.push(payload);
        localStorage.setItem("tipping_platform_workers", JSON.stringify(allSaved));
      } catch (e) {
        console.error("Local storage worker sync failed", e);
      }

      // Try saving to cloud
      try {
        await setDoc(doc(db, "workers", randomId), payload);
      } catch (fsErr) {
        console.warn("Could not save worker to cloud Firestore, local copy saved.", fsErr);
      }

      setCreatedWorker(payload);
      setStep(2);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong during onboarding. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getTippingUrl = () => {
    if (!createdWorker) return "";
    return `${window.location.protocol}//${window.location.host}/?worker=${createdWorker.id}&name=${encodeURIComponent(createdWorker.name)}&pos=${encodeURIComponent(createdWorker.position)}&sub=${encodeURIComponent(createdWorker.subaccountCode)}${createdWorker.employerName ? `&empName=${encodeURIComponent(createdWorker.employerName)}` : ""}`;
  };

  if (step === 2 && createdWorker) {
    const tippingUrl = getTippingUrl();
    return (
      <div id="worker-success" className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl hover:shadow-2xl transition duration-300 p-8 border border-slate-100 flex flex-col items-center">
          
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mb-6 animate-bounce">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>

          <h1 className="text-2xl font-black text-slate-800 tracking-tight text-center">
            Onboarding Completed!
          </h1>
          <p className="text-xs text-slate-400 text-center mt-1">
            Your subaccount has been dynamically established under our Paystack routing profile.
          </p>

          <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 my-6 text-center">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              AUTOMATIC SETTLEMENT PROFILE
            </div>
            <div className="text-xs font-black text-slate-800 tracking-tight">
              {createdWorker.accountName}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {createdWorker.bankName} &middot; {createdWorker.accountNumber}
            </div>
            <div className="mt-3 inline-block bg-blue-50 text-blue-600 border border-blue-100 py-1 px-3 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider">
              {createdWorker.subaccountCode}
            </div>
          </div>

          {/* QR Code component */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 w-full flex flex-col items-center">
            <QrCodeCard worker={createdWorker} />
          </div>

          <div className="w-full space-y-3 mt-6">
            <a
              href={tippingUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition uppercase tracking-wider"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Tipping Page
            </a>
            
            <button
              onClick={() => window.print()}
              className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition uppercase tracking-wider"
            >
              <Printer className="w-4 h-4" />
              Print QR Card
            </button>

            <button
              onClick={onBack}
              className="w-full text-slate-400 hover:text-slate-600 text-xs text-center font-bold uppercase tracking-wider pt-2"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="worker-onboard-page" className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Navigation header */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition text-xs font-bold uppercase tracking-wider mb-8 focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        <div className="bg-white rounded-3xl shadow-xl hover:shadow-2xl transition duration-300 p-8 sm:p-10 border border-slate-100">
          <div className="mb-8">
            <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              INTEGRATION MODULE
            </span>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight mt-3">
              Direct Worker Onboarding
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Receive tips directly inside your own personal bank account without waiting for corporate settlement reviews.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-4 text-xs font-bold mb-6">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Name field */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Name and Surname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Okafor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-blue-500 p-4 text-xs font-bold focus:outline-none transition-all"
                />
              </div>

              {/* ID or Permit passport number */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  ID or Passport / Workpermit Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9605215082089"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-blue-500 p-4 text-xs font-bold focus:outline-none transition-all"
                />
              </div>

              {/* Cell number */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Cell Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +27 82 123 4567"
                  value={cellNumber}
                  onChange={(e) => setCellNumber(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-blue-500 p-4 text-xs font-bold focus:outline-none transition-all"
                />
              </div>

              {/* Role / Occupation free text input */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Role / Occupation Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Waiter / Waitress, Barista, etc."
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-blue-500 p-4 text-xs font-bold focus:outline-none transition-all"
                />
              </div>

              {/* Employer Name if entered auto links */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Employer Name <span className="text-slate-350 font-normal hover:none">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Starbucks Sandton"
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-blue-500 p-4 text-xs font-bold focus:outline-none transition-all"
                />
                <p className="text-[9px] text-slate-400 font-medium">
                  If entered, auto-links your profile to the corresponding Employer dashboard!
                </p>
              </div>

              {/* South African Banks list drop down */}
              <div className="space-y-1.5 md:col-span-2 border-t border-slate-100 pt-6 mt-2">
                <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  SETTLE TO DIRECT SOUTH AFRICAN BANK ACCOUNT
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  South African Bank Name <span className="text-red-500">*</span>
                </label>
                {loadingBanks ? (
                  <div className="py-4 text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    Consulting registers...
                  </div>
                ) : (
                  <select
                    value={selectedBankCode}
                    onChange={(e) => {
                      setSelectedBankCode(e.target.value);
                      setResolvedAccountName(null);
                    }}
                    className="w-full bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-blue-500 p-4 text-xs font-bold focus:outline-none transition-all cursor-pointer"
                  >
                    {banks.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Bank Account Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Bank Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1012345678"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-blue-500 p-4 text-xs font-mono font-black focus:outline-none transition-all"
                />
              </div>

              {/* Resolving banking indicator */}
              {(resolvingAccount || resolvedAccountName) && (
                <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 flex items-center justify-between gap-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Resolved Bank Account Name
                  </div>
                  {resolvingAccount ? (
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 font-bold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Verifying details with Paystack...
                    </div>
                  ) : (
                    <div className="text-xs font-black text-slate-900 tracking-tight uppercase">
                      {resolvedAccountName}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-3.5 rounded-xl mt-4">
              <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                Paystack Verified Integration &middot; Direct Split Routing Enabled &middot; SSL Encrypted
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-bold py-4 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200 shadow-sm uppercase tracking-wider cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Direct Paystack Link...
                </>
              ) : (
                <>
                  Register and Generate QR code
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
