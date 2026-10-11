import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  QrCode,
  IndianRupee,
  Activity,
  UserCheck,
  Search,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Building,
  UserPlus,
  CheckCircle,
  X,
  RefreshCw,
  QrCode as QrIcon
} from "lucide-react";
import { collection, query, where, onSnapshot, doc, setDoc, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Worker, Tip, PaystackBank } from "../types";
import QrCodeCard from "./QrCodeCard";

interface EmployerDashboardProps {
  employerUid: string;
  employerName: string;
  businessName: string;
}

export default function EmployerDashboard({
  employerUid,
  employerName,
  businessName,
}: EmployerDashboardProps) {
  // Workers State
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  // Tips / ledger history
  const [tips, setTips] = useState<Tip[]>([]);
  const [loadingTips, setLoadingTips] = useState(true);

  // Supported Banks List
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);

  // UI States
  const [showAddModal, setShowAddModal] = useState(false);
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);

  // Onboarding Form State
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerPosition, setNewWorkerPosition] = useState("Waiter");
  const [newWorkerEmail, setNewWorkerEmail] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [newWorkerAccountNumber, setNewWorkerAccountNumber] = useState("");
  const [newWorkerIdNumber, setNewWorkerIdNumber] = useState("");
  const [newWorkerCellNumber, setNewWorkerCellNumber] = useState("");

  // Sync Status Tracking
  const [syncStates, setSyncStates] = useState<{ [workerId: string]: "synced" | "local_only" | "checking" | "failed" }>({});
  const [syncStatusSummary, setSyncStatusSummary] = useState<string>("");
  const [isVerifyingSync, setIsVerifyingSync] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const verifySyncOfWorkers = async (workersList: Worker[]) => {
    if (workersList.length === 0) return;
    setIsVerifyingSync(true);
    const newStates = { ...syncStates };
    
    // Set checking state to start
    workersList.forEach((w) => {
      newStates[w.id] = "checking";
    });
    setSyncStates({ ...newStates });

    let syncedCount = 0;
    let localCount = 0;

    for (const w of workersList) {
      if (!w.id) continue;
      try {
        const workerDocRef = doc(db, "workers", w.id);
        const fetchedDoc = await getDoc(workerDocRef);
        if (fetchedDoc.exists()) {
          newStates[w.id] = "synced";
          syncedCount++;
        } else {
          newStates[w.id] = "local_only";
          localCount++;
        }
      } catch (err) {
        console.warn(`Could not verify sync for ${w.id}:`, err);
        newStates[w.id] = "failed";
        localCount++;
      }
      setSyncStates({ ...newStates });
    }

    setIsVerifyingSync(false);
    if (localCount > 0) {
      setSyncStatusSummary(`Cloud Sync Verification: ${localCount} profile(s) stored locally only on this browser registry. Please press Sync to Cloud to repair QR codes!`);
    } else {
      setSyncStatusSummary("Live Sync Connected: All onboarded staff profiles verified present in Cloud Firestore.");
    }
  };

  const forceSyncAllToCloud = async () => {
    setIsVerifyingSync(true);
    setSyncStatusSummary("Directing payload to Firestore API entries...");
    
    let successCount = 0;
    let failCount = 0;
    let lastError = "";

    const newStates = { ...syncStates };

    for (const w of workers) {
      newStates[w.id] = "checking";
      setSyncStates({ ...newStates });

      const payload: Worker = {
        id: w.id,
        employerId: w.employerId || employerUid,
        name: w.name.trim(),
        position: w.position,
        bankName: w.bankName,
        bankCode: w.bankCode,
        accountNumber: w.accountNumber,
        accountName: w.accountName,
        subaccountCode: w.subaccountCode,
        createdAt: w.createdAt || new Date().toISOString(),
      };
      if (w.idNumber) payload.idNumber = w.idNumber;
      if (w.cellNumber) payload.cellNumber = w.cellNumber;
      if (w.email) payload.email = w.email;
      if (w.employerName) payload.employerName = w.employerName;

      try {
        await setDoc(doc(db, "workers", w.id), payload);
        newStates[w.id] = "synced";
        successCount++;
      } catch (err: any) {
        console.error("Sync write failed:", err);
        newStates[w.id] = "failed";
        failCount++;
        lastError = err.message || "Permission / Network error";
      }
      setSyncStates({ ...newStates });
    }

    setIsVerifyingSync(false);
    if (failCount > 0) {
      setSyncStatusSummary(`Warning: ${successCount} synced, ${failCount} failed. Error: ${lastError}`);
      alert(`Cloud sync completed with warnings: ${successCount} success, ${failCount} failed. Error: ${lastError}`);
    } else {
      setSyncStatusSummary("🎉 All profiles successfully locked in! Your QR codes are now fully active on mobile.");
      alert("🎉 All staff profiles successfully synced to the live cloud database! All QR codes are 100% active and scannable on mobile phones.");
    }
  };

  // Automatically trigger sync check whenever workers list is loaded
  useEffect(() => {
    if (workers.length > 0) {
      verifySyncOfWorkers(workers);
    }
  }, [workers.length]);

  // Fetch Banks List on mount
  useEffect(() => {
    async function fetchBanks() {
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
        console.error("Error loading bank directories:", err);
      } finally {
        setLoadingBanks(false);
      }
    }
    fetchBanks();
  }, []);

  // Real-time Firestore synchronizer for Workers under this Employer
  useEffect(() => {
    if (!employerUid) return;

    setLoadingWorkers(true);

    const getLocalWorkers = () => {
      try {
        const saved = localStorage.getItem("tipping_platform_workers");
        if (saved) {
          const allWorkers: Worker[] = JSON.parse(saved);
          return allWorkers.filter((w) => w.employerId === employerUid);
        }
      } catch (e) {
        console.error("Local storage worker retrieval error:", e);
      }
      return [];
    };

    const localList = getLocalWorkers();

    if (employerUid.startsWith("dev_")) {
      setWorkers(localList);
      setLoadingWorkers(false);
      return;
    }

    const workersQuery = query(
      collection(db, "workers"),
      where("employerId", "==", employerUid)
    );

    const unsubscribe = onSnapshot(
      workersQuery,
      (snapshot) => {
        const list: Worker[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Worker);
        });

        // Sync with local storage database copies
        try {
          const savedStr = localStorage.getItem("tipping_platform_workers");
          let allSaved: Worker[] = savedStr ? JSON.parse(savedStr) : [];
          allSaved = allSaved.filter((w) => w.employerId !== employerUid);
          allSaved.push(...list);
          localStorage.setItem("tipping_platform_workers", JSON.stringify(allSaved));
        } catch (e) {
          console.error(e);
        }

        setWorkers(list);
        setLoadingWorkers(false);
      },
      (error) => {
        console.warn("Firestore workers query failed or permission denied, using high-reliability offline storage copy:", error);
        setWorkers(localList);
        setLoadingWorkers(false);
      }
    );

    return () => unsubscribe();
  }, [employerUid]);

  // Real-time Firestore tips watcher for entire Business (employerId == employerUid)
  useEffect(() => {
    if (!employerUid) return;

    setLoadingTips(true);

    const getLocalTips = () => {
      try {
        const saved = localStorage.getItem("tipping_platform_tips");
        if (saved) {
          const allTips: Tip[] = JSON.parse(saved);
          return allTips.filter((t) => t.employerId === employerUid);
        }
      } catch (e) {
        console.error("Local storage tips retrieval error:", e);
      }
      return [];
    };

    const localTipsList = getLocalTips();

    if (employerUid.startsWith("dev_")) {
      setTips(localTipsList);
      setLoadingTips(false);
      return;
    }

    const tipsQuery = query(
      collection(db, "tips"),
      where("employerId", "==", employerUid)
    );

    const unsubscribe = onSnapshot(
      tipsQuery,
      (snapshot) => {
        const list: Tip[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Tip);
        });

        // Sync with local storage tipping ledger copy
        try {
          const savedStr = localStorage.getItem("tipping_platform_tips");
          let allSaved: Tip[] = savedStr ? JSON.parse(savedStr) : [];
          allSaved = allSaved.filter((t) => t.employerId !== employerUid);
          allSaved.push(...list);
          localStorage.setItem("tipping_platform_tips", JSON.stringify(allSaved));
        } catch (e) {
          console.error(e);
        }

        setTips(list);
        setLoadingTips(false);
      },
      (error) => {
        console.warn("Firestore tips query failed or permission denied, reverting to local tipping copies:", error);
        setTips(localTipsList);
        setLoadingTips(false);
      }
    );

    return () => unsubscribe();
  }, [employerUid]);

  // Automatically trigger Bank Account Resolve when Account Number reaches 10 digits
  useEffect(() => {
    if (newWorkerAccountNumber.length === 10 && selectedBankCode !== "") {
      resolveBankAccount();
    } else {
      setResolvedAccountName(null);
    }
  }, [newWorkerAccountNumber, selectedBankCode]);

  // Consult Paystack API to resolve Account Name details
  const resolveBankAccount = async () => {
    setResolvingAccount(true);
    setResolvedAccountName(null);
    try {
      const response = await fetch("/api/paystack/verify-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: newWorkerAccountNumber,
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
      console.error("Failed bank look up:", err);
      setResolvedAccountName("MOCK ACCOUNT (UNVERIFIED)");
    } finally {
      setResolvingAccount(false);
    }
  };

  // Onboard Worker Handler
  // 1. Calls server API to create Paystack Subaccount
  // 2. Stores Worker payload in Firestore
  const handleOnboardWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName || !newWorkerAccountNumber || !selectedBankCode || !newWorkerIdNumber || !newWorkerCellNumber) {
      alert("Please complete all required fields including ID/Passport and Cell numbers.");
      return;
    }

    setOnboardingSubmitting(true);
    const bankObj = banks.find((b) => b.code === selectedBankCode);
    const actualBankName = bankObj ? bankObj.name : "GTBank";

    try {
      // 1. Create Paystack Subaccount
      const subRes = await fetch("/api/paystack/create-subaccount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: `${newWorkerName} (${newWorkerPosition})`,
          settlementBank: selectedBankCode,
          accountNumber: newWorkerAccountNumber,
        }),
      });

      const subJson = await subRes.json();
      if (!subJson.status || !subJson.data) {
        throw new Error(subJson.message || "Subaccount registration failed");
      }

      const paystackSubaccountCode = subJson.data.subaccount_code;

      // 2. Save Worker record in Firestore database
      const randomId = `W_ID_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const payload: Worker = {
        id: randomId,
        employerId: employerUid,
        name: newWorkerName.trim(),
        position: newWorkerPosition,
        bankName: actualBankName,
        bankCode: selectedBankCode,
        accountNumber: newWorkerAccountNumber,
        accountName: resolvedAccountName || newWorkerName.toUpperCase(),
        subaccountCode: paystackSubaccountCode,
        createdAt: new Date().toISOString(),
        idNumber: newWorkerIdNumber.trim(),
        cellNumber: newWorkerCellNumber.trim(),
        employerName: businessName.trim(),
      };

      if (newWorkerEmail.trim() !== "") {
        payload.email = newWorkerEmail.trim();
      }

      // Always save to localStorage database copies
      try {
        const savedStr = localStorage.getItem("tipping_platform_workers");
        const allSaved = savedStr ? JSON.parse(savedStr) : [];
        allSaved.push(payload);
        localStorage.setItem("tipping_platform_workers", JSON.stringify(allSaved));
      } catch (e) {
        console.error(e);
      }

      let dbWriteSuccess = false;
      try {
        await setDoc(doc(db, "workers", randomId), payload);
        dbWriteSuccess = true;
        setSyncStates((prev) => ({ ...prev, [randomId]: "synced" }));
      } catch (fsErr: any) {
        console.warn("Could not save worker to cloud Firestore, proceeding with local credential storage copy", fsErr);
        setSyncStates((prev) => ({ ...prev, [randomId]: "local_only" }));
      }

      // Trigger high-reliability UI update for dev bypass session
      if (employerUid.startsWith("dev_")) {
        setWorkers((prev) => [...prev, payload]);
      }

      // Reset form states
      setNewWorkerName("");
      setNewWorkerEmail("");
      setNewWorkerAccountNumber("");
      setNewWorkerIdNumber("");
      setNewWorkerCellNumber("");
      setResolvedAccountName(null);
      setShowAddModal(false);

      if (dbWriteSuccess) {
        alert(`${newWorkerName} onboarded successfully! Created Paystack code ${paystackSubaccountCode} and successfully registered on live Firestore cloud database.`);
      } else {
        alert(`⚠️ Worker rostered LOCALLY: ${newWorkerName} has been onboarded successfully with Paystack code ${paystackSubaccountCode}.\n\nWARNING: The registration failed to sync to the live Firestore Database. Their QR code will NOT work when scanned from external mobile devices until you run 'Sync to Cloud' under Workers Directory to repair!`);
      }
    } catch (err: any) {
      console.error("Onboarding failed:", err);
      alert(err.message || "Could not register details securely. Check your internet connection.");
    } finally {
      setOnboardingSubmitting(false);
    }
  };

  // Calculations for Metrics Panel
  const successfulTips = tips.filter((t) => t.status === "success");
  const totalTipsSum = successfulTips.reduce((acc, t) => acc + t.amount, 0);
  const totalFeesSum = successfulTips.reduce((acc, t) => acc + t.feeAmount, 0);
  const totalPayoutSum = successfulTips.reduce((acc, t) => acc + t.workerAmount, 0);

  // Filtered workers list
  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-800">
      {/* Upper Portal welcome card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition-all">
        <div>
          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
            ACTIVE PORTAL REGISTRY
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2.5">
            {businessName}
          </h1>
          <p className="text-slate-450 text-xs mt-1.5 leading-relaxed">
            Employer Desk &mdash; Authorized Administrator: <strong className="text-slate-700">{employerName}</strong>
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3.5 px-5 rounded-xl transition-all shadow-sm shadow-blue-200 uppercase tracking-wider cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-white shrink-0" />
          Onboard New Worker
        </button>
      </div>

      {/* Metrics Dashboard Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-150/70 rounded-2xl p-6 shadow-sm space-y-1 relative overflow-hidden hover:shadow-md transition-all">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Tips Collected</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            R{totalTipsSum.toLocaleString()}
          </div>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Total gross operations volume</p>
        </div>

        <div className="bg-white border border-slate-150/70 rounded-2xl p-6 shadow-sm space-y-1 relative overflow-hidden hover:shadow-md transition-all">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Automated Net Payouts</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 tracking-tight mt-1">
            R{totalPayoutSum.toLocaleString()}
          </div>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Routed directly to staff bank (98%)</p>
        </div>

        <div className="bg-white border border-slate-150/70 rounded-2xl p-6 shadow-sm space-y-1 relative overflow-hidden hover:shadow-md transition-all">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipping Platform Fees</span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            R{totalFeesSum.toLocaleString()}
          </div>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Retained SLA system charge (2%)</p>
        </div>
      </div>

      {/* Primary interactive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Workers Directory column (left side) */}
        <div className="lg:col-span-7 bg-white border border-slate-150/70 rounded-2xl p-6 shadow-sm space-y-4 hover:shadow-md transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 font-sans">Workers Directory</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Staff roster authorized to collect direct splits</p>
            </div>
            <div className="relative rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2 focus-within:border-blue-500 transition bg-slate-50/50">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                aria-label="Search workers"
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs focus:outline-none w-full sm:w-32 font-semibold bg-transparent"
              />
            </div>
          </div>

          {/* New Cloud Sync Diagnosis & Repair Banner */}
          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isVerifyingSync ? "animate-spin text-blue-600" : ""}`} />
                <span className="font-extrabold uppercase tracking-wide text-slate-600 text-[10px]">Cloud Sync Integrity</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => verifySyncOfWorkers(workers)}
                  disabled={isVerifyingSync}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                >
                  Verify Now
                </button>
                <button
                  onClick={forceSyncAllToCloud}
                  disabled={isVerifyingSync}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  Sync to Cloud ☁️
                </button>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {syncStatusSummary || "Analyzing the synchronization status of your worker profiles on the central registry..."}
            </div>
          </div>

          <div className="h-px bg-slate-100"></div>

          {loadingWorkers ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-3">
              <Users className="w-8 h-8 mx-auto opacity-30 stroke-[1.5]" />
              <p className="text-xs uppercase tracking-wider font-bold">No registered staff matched.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer uppercase tracking-wider"
              >
                Onboard one now
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {filteredWorkers.map((w) => {
                const isSelected = selectedWorker?.id === w.id;
                // Calculate individual collected tips
                const workerTips = successfulTips.filter((t) => t.workerId === w.id);
                const sumTips = workerTips.reduce((acc, t) => acc + t.amount, 0);

                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWorker(w)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-155 flex items-center justify-between gap-4 cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-md"
                        : "bg-white hover:bg-slate-50 border-slate-150"
                    }`}
                  >
                    <div className="flex items-center gap-4 truncate">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center font-extrabold text-xs shrink-0 ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-700"
                            : "bg-blue-50 border-blue-100 text-blue-600"
                        }`}
                      >
                        <span>{w.name.charAt(0)}</span>
                      </div>
                      <div className="truncate pl-1">
                        <div className={`font-bold text-xs uppercase tracking-tight flex items-center gap-1.5 wrap ${isSelected ? "text-white" : "text-slate-900"}`}>
                          <span className="truncate">{w.name}</span>
                          {syncStates[w.id] === "synced" && (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-extrabold tracking-wider uppercase shrink-0 ${isSelected ? "bg-emerald-900/50 text-emerald-300 border border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border border-emerald-150"}`}>
                              Cloud Synced
                            </span>
                          )}
                          {syncStates[w.id] === "local_only" && (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-extrabold tracking-wider uppercase shrink-0 animate-pulse ${isSelected ? "bg-rose-950/60 text-rose-200 border border-rose-500/30" : "bg-rose-50 text-rose-600 border border-rose-150"}`}>
                              Local Only (Needs Sync)
                            </span>
                          )}
                          {syncStates[w.id] === "checking" && (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-extrabold tracking-wider uppercase shrink-0 animate-pulse ${isSelected ? "bg-blue-900/55 text-blue-200" : "bg-blue-50 text-blue-600 border border-blue-150"}`}>
                              Checking...
                            </span>
                          )}
                          {syncStates[w.id] === "failed" && (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-extrabold tracking-wider uppercase shrink-0 ${isSelected ? "bg-red-950 text-red-200" : "bg-red-100 text-red-700"}`}>
                              Failed
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-[9px] uppercase font-bold tracking-wider mt-0.5 ${
                            isSelected ? "text-blue-300" : "text-slate-400"
                          }`}
                        >
                          {w.position}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold">R{sumTips.toLocaleString()}</div>
                        <div
                          className={`text-[9px] uppercase tracking-wider font-bold mt-0.5 ${isSelected ? "text-slate-400" : "text-slate-400"}`}
                        >
                          {workerTips.length} splits
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Worker Panel (right side) */}
        <div className="lg:col-span-5 space-y-4">
          {selectedWorker ? (
            <div className="space-y-4">
              {/* Standee QR Card Wrapper */}
              <QrCodeCard worker={selectedWorker} />

              {/* Bank Account Verification details card */}
              <div className="bg-white border border-slate-150/70 rounded-2xl p-6 shadow-sm space-y-3.5 hover:shadow-md transition-all">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Worker Bank Details
                </h3>
                <div className="h-px bg-slate-100"></div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Bank Name</div>
                    <div className="font-extrabold text-slate-900 tracking-tight mt-1 truncate uppercase">
                      {selectedWorker.bankName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Account Number</div>
                    <div className="font-bold text-slate-900 tracking-tight mt-1 font-mono">
                      {selectedWorker.accountNumber}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Account Holder Name</div>
                    <div className="font-bold text-blue-600 tracking-tight mt-1 uppercase">
                      {selectedWorker.accountName}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">
                      Split Settlement Destination Code
                    </div>
                    <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-150 mt-1.5 font-mono text-[10px] text-slate-800 select-all tracking-tight truncate">
                      {selectedWorker.subaccountCode}
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Worker payout ledger */}
              <div className="bg-white border border-slate-150/70 rounded-2xl p-6 shadow-sm space-y-3 hover:shadow-md transition-all">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {selectedWorker.name}'s Tips Ledger
                </h3>
                <div className="h-px bg-slate-100"></div>

                {loadingTips ? (
                  <div className="animate-pulse h-12 bg-slate-50 rounded-xl" />
                ) : tips.filter((t) => t.workerId === selectedWorker.id).length === 0 ? (
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 py-3 text-center">
                    No tipping records for this worker on the roster yet.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                    {tips
                      .filter((t) => t.workerId === selectedWorker.id && t.status === "success")
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-950 font-mono">
                              R{t.amount.toLocaleString()}
                            </div>
                            <div className="text-[9px] text-blue-600 uppercase tracking-wider font-bold truncate max-w-[150px]">
                              {t.customerEmail}
                            </div>
                          </div>
                          <div className="text-right text-[9px] text-slate-400 font-bold uppercase">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-8 py-16 text-center space-y-4 text-slate-400">
              <div className="w-11 h-11 bg-white border border-slate-150 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-sm">
                <QrIcon className="w-5 h-5 text-slate-450" />
              </div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tipping Panel Monitor</h3>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                Select any onboarded crew member from the directory to display their custom standee card and ledger.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Onboarding Dialog Modal overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full border border-slate-100 shadow-2xl relative space-y-6">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full p-1.5 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
                ONBOARDING MODULE
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-3">
                Onboard Professional Worker
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Provide legitimate bank coordinates to configure instant Paystack credit splits.
              </p>
            </div>

            <form onSubmit={handleOnboardWorkerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Worker Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Samuel Okafor"
                    value={newWorkerName}
                    onChange={(e) => setNewWorkerName(e.target.value)}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-500 p-3 text-xs font-semibold focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Roster Title / Position <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Waiter / Waitress, Barista"
                    value={newWorkerPosition}
                    onChange={(e) => setNewWorkerPosition(e.target.value)}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-500 p-3 text-xs font-semibold focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Worker Email <span className="text-slate-305 font-normal hover:none">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="name@domain.com"
                    value={newWorkerEmail}
                    onChange={(e) => setNewWorkerEmail(e.target.value)}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-500 p-3 text-xs font-semibold focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    ID / Passport Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9605215082089"
                    value={newWorkerIdNumber}
                    onChange={(e) => setNewWorkerIdNumber(e.target.value)}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-500 p-3 text-xs font-semibold focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Cell Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +27 82 123 4567"
                    value={newWorkerCellNumber}
                    onChange={(e) => setNewWorkerCellNumber(e.target.value)}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-500 p-3 text-xs font-semibold focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Settlement Payout Bank <span className="text-red-500">*</span>
                  </label>
                  {loadingBanks ? (
                    <div className="py-3.5 text-xs text-slate-400 font-medium">
                      Consulting registers...
                    </div>
                  ) : (
                    <select
                      value={selectedBankCode}
                      onChange={(e) => {
                        setSelectedBankCode(e.target.value);
                        setResolvedAccountName(null);
                      }}
                      className="w-full bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-500 p-3 text-xs font-bold focus:outline-none transition-all cursor-pointer"
                    >
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Bank Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="10 numeric digits"
                    value={newWorkerAccountNumber}
                    onChange={(e) =>
                      setNewWorkerAccountNumber(e.target.value.replace(/\D/g, ""))
                    }
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-500 p-3 text-xs font-mono font-black focus:outline-none transition-all"
                  />
                </div>

                {/* Resolved Verified Account Name feedback panel */}
                {(resolvingAccount || resolvedAccountName) && (
                  <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 flex items-center justify-between gap-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Resolved Account Title
                    </div>
                    {resolvingAccount ? (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 font-bold">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Verifying details...
                      </div>
                    ) : (
                      <div className="text-xs font-black text-slate-900 tracking-tight uppercase">
                        {resolvedAccountName}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={onboardingSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-bold p-4 rounded-xl transition duration-150 shadow-sm text-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  {onboardingSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving splits...
                    </>
                  ) : (
                    "Confirm & Register Worker"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
