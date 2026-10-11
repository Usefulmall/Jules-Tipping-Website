import { useState, useEffect } from "react";
import {
  TrendingUp,
  Activity,
  CreditCard,
  Building,
  Users,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Worker, Tip, UserProfile } from "../types";

export default function AdminDashboard() {
  const [employers, setEmployers] = useState<UserProfile[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"metrics" | "companies" | "workers" | "ledger">("metrics");
  const [ledgerSearch, setLedgerSearch] = useState("");

  useEffect(() => {
    setLoading(true);

    const getLocalEmployers = (): UserProfile[] => {
      try {
        const saved = localStorage.getItem("tipping_platform_employers");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
      return [
        { uid: "emp_starbucks", email: "manager@starbucks-waterfront.co.za", name: "Starbucks Waterfront", role: "employer", createdAt: new Date().toISOString(), businessName: "Starbucks Waterfront" },
        { uid: "emp_laparada", email: "admin@laparada-cape.co.za", name: "La Parada Restaurant", role: "employer", createdAt: new Date().toISOString(), businessName: "La Parada Group" },
        { uid: "emp_tashas", email: "info@tashas-sandton.co.za", name: "Tasha's Café Sandton", role: "employer", createdAt: new Date().toISOString(), businessName: "Tasha's Café" }
      ];
    };

    const getLocalWorkers = (): Worker[] => {
      try {
        const saved = localStorage.getItem("tipping_platform_workers");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
      return [
        { id: "W_ID_SIPHO", employerId: "emp_starbucks", name: "Sipho Ngwenya", position: "Waiter", bankName: "Capitec Bank", bankCode: "capitec-bank", accountNumber: "1012345678", accountName: "SIPHO NGWENYA", subaccountCode: "ACCT_sa1v23b4n5", createdAt: new Date().toISOString(), idNumber: "9201015678081", cellNumber: "0720000001", employerName: "Starbucks Waterfront" },
        { id: "W_ID_LINDIWE", employerId: "emp_starbucks", name: "Lindiwe Dlamini", position: "Barista", bankName: "First National Bank (FNB)", bankCode: "first-national-bank", accountNumber: "2019876543", accountName: "LINDIWE DLAMINI", subaccountCode: "ACCT_sa6c7r8y9u", createdAt: new Date().toISOString(), idNumber: "9510105021085", cellNumber: "0830000002", employerName: "Starbucks Waterfront" },
        { id: "W_ID_FRANCOIS", employerId: "emp_laparada", name: "Francois Du Toit", position: "Valet Driver", bankName: "Standard Bank of South Africa", bankCode: "standard-bank", accountNumber: "3015555555", accountName: "FRANCOIS DU TOIT", subaccountCode: "ACCT_sa4z5x6c7v", createdAt: new Date().toISOString(), idNumber: "8805055011084", cellNumber: "0820000003", employerName: "La Parada Restaurant" }
      ];
    };

    const getLocalTips = (): Tip[] => {
      try {
        const saved = localStorage.getItem("tipping_platform_tips");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
      return [
        { id: "T_ID_101", workerId: "W_ID_SIPHO", workerName: "Sipho Ngwenya", employerId: "emp_starbucks", amount: 150, feeAmount: 3.00, workerAmount: 147, reference: "PAY-9x2u3y-MOCK", status: "success", createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), customerEmail: "guest1@example.com", customerName: "John Doe" },
        { id: "T_ID_102", workerId: "W_ID_LINDIWE", workerName: "Lindiwe Dlamini", employerId: "emp_starbucks", amount: 80, feeAmount: 1.60, workerAmount: 78.40, reference: "PAY-8k4m2j-MOCK", status: "success", createdAt: new Date(Date.now() - 3600000 * 5).toISOString(), customerEmail: "guest2@example.com" },
        { id: "T_ID_103", workerId: "W_ID_FRANCOIS", workerName: "Francois Du Toit", employerId: "emp_laparada", amount: 450, feeAmount: 9.00, workerAmount: 441, reference: "PAY-3h6g2f-MOCK", status: "success", createdAt: new Date(Date.now() - 3600000 * 12).toISOString(), customerEmail: "guest3@example.com", customerName: "Sarah Smith" }
      ];
    };

    // 1. Snapshot for Employers (registered users)
    const employersUnsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as any);
        });
        const defaults = getLocalEmployers();
        const merged = [...list];
        defaults.forEach((def) => {
          if (!merged.some(m => m.uid === def.uid)) merged.push(def);
        });
        setEmployers(merged);
        localStorage.setItem("tipping_platform_employers", JSON.stringify(merged));
      },
      (err) => {
        console.warn("Firestore collection users access restricted, reverting to local mock database registry:", err);
        setEmployers(getLocalEmployers());
      }
    );

    // 2. Snapshot for Workers
    const workersUnsub = onSnapshot(
      collection(db, "workers"),
      (snap) => {
        const list: Worker[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Worker);
        });
        const defaults = getLocalWorkers();
        const merged = [...list];
        defaults.forEach((def) => {
          if (!merged.some(m => m.id === def.id)) merged.push(def);
        });
        setWorkers(merged);
        localStorage.setItem("tipping_platform_workers", JSON.stringify(merged));
      },
      (err) => {
        console.warn("Firestore collection workers access restricted, reverting to local mock database registry:", err);
        setWorkers(getLocalWorkers());
      }
    );

    // 3. Snapshot for Tips ledger entries
    const tipsUnsub = onSnapshot(
      collection(db, "tips"),
      (snap) => {
        const list: Tip[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Tip);
        });
        const defaults = getLocalTips();
        const merged = [...list];
        defaults.forEach((def) => {
          if (!merged.some(m => m.id === def.id)) merged.push(def);
        });
        setTips(merged);
        localStorage.setItem("tipping_platform_tips", JSON.stringify(merged));
        setLoading(false);
      },
      (err) => {
        console.warn("Firestore collection tips access restricted, reverting to local mock database registry:", err);
        setTips(getLocalTips());
        setLoading(false);
      }
    );

    return () => {
      employersUnsub();
      workersUnsub();
      tipsUnsub();
    };
  }, []);

  // Filter out success tips
  const successfulTips = tips.filter((t) => t.status === "success");

  // Sum metrics
  const totalVolume = successfulTips.reduce((acc, t) => acc + t.amount, 0);
  const totalFees = successfulTips.reduce((acc, t) => acc + t.feeAmount, 0);
  const totalWorkerPayouts = successfulTips.reduce((acc, t) => acc + t.workerAmount, 0);

  // Tab titles list
  const tabs = [
    { id: "metrics", label: "Stats overview", icon: TrendingUp },
    { id: "companies", label: "Registered Employers", icon: Building },
    { id: "workers", label: "Workers Registry", icon: Users },
    { id: "ledger", label: "Tipping splits Ledger", icon: Activity }
  ] as const;

  return (
    <div className="space-y-6">
      {/* Admin Welcome Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ShieldCheck className="w-32 h-32 stroke-[1]" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/30 px-3 py-1 rounded-full inline-block">
          PLATFORM MANAGEMENT
        </span>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-3">
          Tipping Platform Control Panel
        </h1>
        <p className="text-slate-400 text-xs mt-2 max-w-xl leading-relaxed">
          Platform-level overview. Auditing system-wide 2% split transactions, active merchant credentials, and worker settlement registries autonomously.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-xs text-slate-400 font-semibold uppercase mt-4 tracking-wider">Auditing databases...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Quick tab switchers */}
          <div className="flex flex-wrap gap-2.5 animate-fade-in no-print">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition duration-150 border cursor-pointer uppercase tracking-wider ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Render Active view based on Tab */}
          {activeTab === "metrics" && (
            <div className="space-y-6">
              
              {/* Gross Split aggregates row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    Gross tipping volume
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    R{totalVolume.toLocaleString()}
                  </div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-450 font-bold mt-1">Total authorized tips</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    Platform Revenue (2%)
                  </div>
                  <div className="text-2xl font-black text-blue-600 mt-1">
                    R{totalFees.toLocaleString()}
                  </div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-450 font-bold mt-1">Accumulated system split</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    Workers Payout Piles (98%)
                  </div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    R{totalWorkerPayouts.toLocaleString()}
                  </div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-450 font-bold mt-1">Routed successfully to bank</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    Active Businesses
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {employers.length}
                  </div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-450 font-bold mt-1">Onboarded merchant accounts</p>
                </div>
              </div>

              {/* Sub metrics list details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Splits audit statistics</h3>
                  <div className="h-px bg-slate-100"></div>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Onboarded staff roster size:</span>
                      <span className="font-bold text-slate-900">{workers.length} workers</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total registered tip intents:</span>
                      <span className="font-bold text-slate-900">{tips.length} transactions</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed split transactions:</span>
                      <span className="font-bold text-emerald-600">{successfulTips.length} successful</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Failed / Cancelled flows:</span>
                      <span className="font-bold text-red-500">
                        {tips.filter((t) => t.status === "failed").length} failed
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average tip amount:</span>
                      <span className="font-bold text-blue-600">
                        R
                        {successfulTips.length > 0
                          ? Math.round(totalVolume / successfulTips.length).toLocaleString()
                          : "0"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-center text-center">
                  <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Platform fee is locked</h3>
                  <p className="text-xs text-slate-450 max-w-xs mx-auto mt-1 leading-relaxed font-sans">
                    Platform retains exactly <strong>2.0%</strong> of every single transaction volume. The remaining <strong>98.0%</strong> is settled directly to worker subaccounts on Paystack automatically.
                  </p>
                </div>
              </div>

            </div>
          )}

          {activeTab === "companies" && (
            <div className="bg-white border border-slate-105 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Registered Employers</h2>
                <p className="text-xs text-slate-400 mt-0.5">Partners registered on the high-speed tipping platform</p>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                      <th className="p-4 font-sans text-[8px]">Business / Employer</th>
                      <th className="p-4 font-sans text-[8px]">Admin Name</th>
                      <th className="p-4 font-sans text-[8px]">Registered Email</th>
                      <th className="p-4 font-sans text-[8px]">Registration Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {employers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 uppercase tracking-wider font-bold">
                          No employers currently registered on the platform.
                        </td>
                      </tr>
                    ) : (
                      employers.map((emp) => (
                        <tr key={emp.uid} className="hover:bg-slate-50/50">
                          <td className="p-4 text-slate-900 font-bold flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                            {emp.businessName || "Unnamed Business"}
                          </td>
                          <td className="p-4 uppercase text-xs">{emp.name}</td>
                          <td className="p-4 text-slate-500 font-mono text-xs">{emp.email}</td>
                          <td className="p-4 text-slate-450 text-xs font-mono">
                            {new Date(emp.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "workers" && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Workers Settlement Registry</h2>
                <p className="text-xs text-slate-400 mt-0.5">Unified roster directory showing active banks and split codes</p>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                      <th className="p-4 font-sans text-[8px]">Worker Details</th>
                      <th className="p-4 font-sans text-[8px]">Role Position</th>
                      <th className="p-4 font-sans text-[8px]">Payout Account Coordinates</th>
                      <th className="p-4 font-sans text-[8px]">Paystack Split Code</th>
                      <th className="p-4 font-sans text-[8px]">Registration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {workers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 uppercase tracking-wider font-bold">
                          No workers currently onboarded to the system.
                        </td>
                      </tr>
                    ) : (
                      workers.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/50">
                          <td className="p-4">
                            <div className="font-bold text-slate-900 uppercase text-xs">{w.name}</div>
                            {w.email && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{w.email}</div>}
                          </td>
                          <td className="p-4 text-xs">
                            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-[8px] uppercase font-bold tracking-wider">
                              {w.position}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">{w.bankName}</div>
                            <div className="text-[10px] text-slate-450 mt-0.5">
                              AC: {w.accountNumber} &middot; {w.accountName}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-[10px] text-blue-600 select-all font-bold tracking-wider">
                            {w.subaccountCode}
                          </td>
                          <td className="p-4 text-slate-450 font-mono text-xs">
                            {new Date(w.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "ledger" && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Tipping Splits Ledger</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Chronological system ledger showing gross and net automation splits</p>
                </div>

                <div className="relative rounded-xl border border-slate-200 px-3.5 py-2.5 flex items-center gap-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition bg-slate-50/50">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search client email..."
                    value={ledgerSearch}
                    aria-label="Search ledger"
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="text-xs focus:outline-none w-full sm:w-48 font-semibold bg-transparent"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                      <th className="p-4 font-sans text-[8px]">Timestamp</th>
                      <th className="p-4 font-sans text-[8px]">Customer Details</th>
                      <th className="p-4 font-sans text-[8px]">Recipient Staff</th>
                      <th className="p-4 font-sans text-[8px]">Gross charge</th>
                      <th className="p-4 font-sans text-[8px]">Staff Split (98%)</th>
                      <th className="p-4 font-sans text-[8px]">System Split (2%)</th>
                      <th className="p-4 font-sans text-[8px]">Transaction Reference</th>
                      <th className="p-4 font-sans text-[8px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {ledgerSearch !== "" &&
                    tips.filter((t) => t.customerEmail.toLowerCase().includes(ledgerSearch.toLowerCase()))
                      .length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 uppercase tracking-wider font-bold">
                          No matching ledger items found.
                        </td>
                      </tr>
                    ) : tips.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 uppercase tracking-wider font-bold">
                          Empty platform ledger. No tip requests created.
                        </td>
                      </tr>
                    ) : (
                      tips
                        .filter(
                          (t) =>
                              ledgerSearch === "" ||
                              t.customerEmail.toLowerCase().includes(ledgerSearch.toLowerCase())
                        )
                        .map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/50">
                            <td className="p-4 text-slate-400 text-[10px] font-mono whitespace-nowrap">
                              {new Date(t.createdAt).toLocaleDateString()} &middot;{" "}
                              {new Date(t.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="p-4 font-mono text-[11px] text-slate-900">
                              {t.customerEmail}
                              {t.customerName && (
                                <span className="block text-[9px] text-slate-400 font-sans font-semibold uppercase tracking-wider mt-0.5">
                                  Name: {t.customerName}
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-slate-950 uppercase text-xs">{t.workerName}</span>
                            </td>
                            <td className="p-4 font-mono text-slate-900 font-bold text-xs">
                              R{t.amount.toLocaleString()}
                            </td>
                            <td className="p-4 text-xs text-emerald-600 font-bold font-mono">
                              R{t.workerAmount.toLocaleString()}
                            </td>
                            <td className="p-4 text-xs font-bold text-blue-600 font-mono">
                              R{t.feeAmount.toLocaleString()}
                            </td>
                            <td className="p-4 font-mono text-[10px] text-slate-500 break-all select-all">
                              {t.reference}
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[8px] font-bold tracking-wider uppercase ${
                                  t.status === "success"
                                    ? "bg-emerald-50 text-emerald-800"
                                    : t.status === "failed"
                                    ? "bg-red-50 text-red-800"
                                    : "bg-slate-50 text-slate-655"
                                  }`}
                              >
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
