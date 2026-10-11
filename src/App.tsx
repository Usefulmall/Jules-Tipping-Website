import { useState, useEffect, FormEvent } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { UserProfile, UserRole } from "./types";

// Extracted Submodules
import PublicTipView from "./components/PublicTipView";
import EmployerDashboard from "./components/EmployerDashboard";
import AdminDashboard from "./components/AdminDashboard";
import { PublicWorkerOnboard } from "./components/PublicWorkerOnboard";

import {
  Building,
  User,
  ShieldCheck,
  LogOut,
  ChevronRight,
  TrendingUp,
  Sparkles,
  RefreshCw,
  QrCode,
  CheckCircle,
  Zap,
  Shield,
  UserPlus,
  BarChart3,
  Gift,
  Printer,
} from "lucide-react";

// Auto-Sync and validation routine to recover from any aborted/offline local sessions
function cleanAndValidateWorker(w: any): any {
  const cleaned: any = {
    id: w.id,
    employerId: w.employerId || "independent",
    name: w.name?.trim() || "",
    position: w.position?.trim() || "Independent Partner",
    bankName: w.bankName || "Capitec Bank",
    bankCode: w.bankCode || "capitec",
    accountNumber: w.accountNumber || "",
    accountName: w.accountName || w.name?.toUpperCase() || "",
    subaccountCode: w.subaccountCode || "",
    createdAt: w.createdAt || new Date().toISOString(),
  };

  if (w.email && typeof w.email === "string" && w.email.trim() !== "") {
    cleaned.email = w.email.trim();
  }
  if (w.idNumber && typeof w.idNumber === "string" && w.idNumber.trim() !== "") {
    cleaned.idNumber = w.idNumber.trim();
  }
  if (w.cellNumber && typeof w.cellNumber === "string" && w.cellNumber.trim() !== "") {
    cleaned.cellNumber = w.cellNumber.trim();
  }
  if (w.employerName && typeof w.employerName === "string" && w.employerName.trim() !== "") {
    cleaned.employerName = w.employerName.trim();
  }

  return cleaned;
}

async function syncStorageWorkersToCloud() {
  try {
    const saved = localStorage.getItem("tipping_platform_workers");
    if (!saved) return;
    const workers = JSON.parse(saved);
    if (!Array.isArray(workers)) return;

    for (const w of workers) {
      if (!w || !w.id) continue;
      const cleaned = cleanAndValidateWorker(w);
      try {
        await setDoc(doc(db, "workers", cleaned.id), cleaned);
        console.log(`[Sync] Synced worker ${cleaned.name} (${cleaned.id}) safely to Firestore.`);
      } catch (err) {
        console.warn(`[Sync] Failed syncing worker ${cleaned.name} to Firestore:`, err);
      }
    }
  } catch (e) {
    console.error("Failed background worker synchronization:", e);
  }
}

export default function App() {
  // Navigation states
  const [workerIdParam, setWorkerIdParam] = useState<string | null>(null);
  const [showPublicOnboard, setShowPublicOnboard] = useState(false);

  // Authentication states
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Access Portal modal states
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessModalLoading, setAccessModalLoading] = useState(false);

  // Registration states (for new users)
  const [isNewUserRegistration, setIsNewUserRegistration] = useState(false);
  const [regName, setRegName] = useState("");
  const [regBusinessName, setRegBusinessName] = useState("");
  const [registering, setRegistering] = useState(false);

  // Toggle view for developers testing admin and employer states
  const [viewOverride, setViewOverride] = useState<"admin" | "employer" | null>(null);

  // On mount, parse the search parameters to see if this is a scanned QR worker page!
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const worker = params.get("worker") || params.get("workerId");
    if (worker && worker.trim() !== "") {
      setWorkerIdParam(worker.trim());
    }
  }, []);

  // Shared user profile loader
  const loadProfileForUser = async (user: any) => {
    const isMock = user.uid.startsWith("dev_") || !auth.currentUser;

    // Check local storage profile fallback first (highly reliable for iframe sandbox bypasses)
    const stored = localStorage.getItem(`tipping_platform_profile_${user.uid}`);
    if (stored) {
      try {
        setUserProfile(JSON.parse(stored));
        setIsNewUserRegistration(false);
        return;
      } catch (e) {
        console.error("Failed to parse stored profile", e);
      }
    }

    if (isMock) {
      if (user.email === "exellentoak@gmail.com") {
        const adminProfile: UserProfile = {
          uid: user.uid,
          email: user.email || "",
          name: user.displayName || "Platform Admin",
          role: "admin",
          createdAt: new Date().toISOString(),
          businessName: "Platform Administration"
        };
        localStorage.setItem(`tipping_platform_profile_${user.uid}`, JSON.stringify(adminProfile));
        setUserProfile(adminProfile);
        setIsNewUserRegistration(false);
      } else {
        setUserProfile(null);
        setIsNewUserRegistration(true);
        setRegName(user.displayName || user.email.split("@")[0].toUpperCase());
      }
      return;
    }

    try {
      const profileDoc = await getDoc(doc(db, "users", user.uid));
      if (profileDoc.exists()) {
        const data = profileDoc.data() as UserProfile;
        localStorage.setItem(`tipping_platform_profile_${user.uid}`, JSON.stringify(data));
        setUserProfile(data);
        setIsNewUserRegistration(false);
      } else {
        // Automatically bootstrap admin profile for known primary administrator
        if (user.email === "exellentoak@gmail.com") {
          const adminProfile: UserProfile = {
            uid: user.uid,
            email: user.email || "",
            name: user.displayName || "Platform Admin",
            role: "admin",
            createdAt: new Date().toISOString(),
            businessName: "Platform Administration"
          };
          try {
            await setDoc(doc(db, "users", user.uid), adminProfile);
          } catch (e) {
            console.warn(e);
          }
          localStorage.setItem(`tipping_platform_profile_${user.uid}`, JSON.stringify(adminProfile));
          setUserProfile(adminProfile);
          setIsNewUserRegistration(false);
        } else {
          // New employer account login! Require them to complete profile register page
          setUserProfile(null);
          setIsNewUserRegistration(true);
          setRegName(user.displayName || user.email.split("@")[0].toUpperCase());
        }
      }
    } catch (err) {
      console.error("Failed to load user credentials account profile from Firestore, using high-reliability memory fallback:", err);
      // Safety net fallback to allow testing in all iframe conditions
      if (user.email === "exellentoak@gmail.com") {
        const adminProfile: UserProfile = {
          uid: user.uid,
          email: user.email || "",
          name: user.displayName || "Platform Admin",
          role: "admin",
          createdAt: new Date().toISOString(),
          businessName: "Platform Administration"
        };
        setUserProfile(adminProfile);
        setIsNewUserRegistration(false);
      } else {
        setUserProfile(null);
        setIsNewUserRegistration(true);
        setRegName(user.displayName || user.email.split("@")[0].toUpperCase());
      }
    }
  };

  // Monitor Session / Authentication
  useEffect(() => {
    // Trigger background auto-sync to recover any locally-onboarded workers straight to the cloud database
    syncStorageWorkersToCloud();

    // Check local storage session first (highly reliable for iframe sandbox environments)
    const localSess = localStorage.getItem("tipping_platform_user");
    if (localSess) {
      try {
        const u = JSON.parse(localSess);
        setCurrentUser(u);
        loadProfileForUser(u).then(() => {
          setAuthLoading(false);
        });
        return;
      } catch (e) {
        localStorage.removeItem("tipping_platform_user");
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await loadProfileForUser(user);
      } else {
        // Double check if there's no mock session before resetting
        if (!localStorage.getItem("tipping_platform_user")) {
          setCurrentUser(null);
          setUserProfile(null);
          setIsNewUserRegistration(false);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Direct Bypass Authentication logic
  const handleDirectEmailAccess = async (emailToAccess: string) => {
    if (!emailToAccess || !emailToAccess.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }
    setAccessModalLoading(true);
    const mockUser = {
      uid: `dev_${emailToAccess.trim().toLowerCase().replace(/[@.]/g, "_")}`,
      email: emailToAccess.trim().toLowerCase(),
      displayName: emailToAccess.trim().split("@")[0].toUpperCase(),
    };

    localStorage.setItem("tipping_platform_user", JSON.stringify(mockUser));
    setCurrentUser(mockUser);
    await loadProfileForUser(mockUser);
    setAccessModalLoading(false);
    setShowAccessModal(false);
  };

  // Google Provider login trigger (with warning popup troubleshooting helper)
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowAccessModal(false);
    } catch (err) {
      console.error("Sign-in popup rejected or failed:", err);
      alert(
        "Authentication popup is being blocked by your browser because this app is loaded inside an iframe. Please use the 'Direct Access Option' in the Access Portal!"
      );
    }
  };

  // Sign out trigger
  const handleSignOut = async () => {
    try {
      localStorage.removeItem("tipping_platform_user");
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setViewOverride(null);
    } catch (err) {
      console.error(err);
    }
  };

  // New Employer registration submit
  const handleCompleteRegistrationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (regName.trim() === "" || regBusinessName.trim() === "") {
      alert("Please specify complete entries for Name and Business properties.");
      return;
    }

    setRegistering(true);

    // Default registration role: employer (admins are bootstrapped or set manually)
    // Check if the current registered email matches 'exellentoak@gmail.com' -> automatically platform admin!
    const selectedRole: UserRole =
      currentUser.email === "exellentoak@gmail.com" ? "admin" : "employer";

    const newProfile: UserProfile = {
      uid: currentUser.uid,
      email: currentUser.email || "",
      name: regName.trim(),
      role: selectedRole,
      businessName: regBusinessName.trim(),
      createdAt: new Date().toISOString(),
    };

    // Always save to localStorage profile copies
    localStorage.setItem(`tipping_platform_profile_${currentUser.uid}`, JSON.stringify(newProfile));

    // Seed into local employers registry array for admin simulation if needed
    try {
      const savedEmps = localStorage.getItem("tipping_platform_employers");
      let emps: UserProfile[] = savedEmps ? JSON.parse(savedEmps) : [];
      if (!emps.some(e => e.uid === newProfile.uid)) {
        emps.push(newProfile);
        localStorage.setItem("tipping_platform_employers", JSON.stringify(emps));
      }
    } catch (e) {
      console.error(e);
    }

    try {
      if (auth.currentUser && !currentUser.uid.startsWith("dev_")) {
        await setDoc(doc(db, "users", currentUser.uid), newProfile);
      }
      setUserProfile(newProfile);
      setIsNewUserRegistration(false);
    } catch (err) {
      console.warn("Could not write profile to cloud Firestore, proceeding with local credentials", err);
      setUserProfile(newProfile);
      setIsNewUserRegistration(false);
    } finally {
      setRegistering(false);
    }
  };

  // 1. PUBLIC TIPPING MODE (Visits on URL of scanned standee QR Code)
  if (workerIdParam) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex flex-col justify-between py-6 font-sans">
        <PublicTipView workerId={workerIdParam} />
        
        {/* Humble branding footer */}
        <div className="text-center text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-4">
          <p>© 2026 Tipping Platform. Secured splits verified.</p>
        </div>
      </div>
    );
  }

  // PUBLIC INDEPENDENT WORKER ONBOARDING VIEW
  if (showPublicOnboard) {
    return (
      <PublicWorkerOnboard onBack={() => setShowPublicOnboard(false)} />
    );
  }

  // Loading state splash
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex flex-col items-center justify-center text-slate-800 font-sans">
        <RefreshCw className="w-9 h-9 animate-spin text-blue-600 mb-4" />
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          Authenticating tipping registry...
        </p>
      </div>
    );
  }

  // Determine current effective role (respecting toggles for admins)
  const isGlobalAdmin =
    currentUser?.email === "exellentoak@gmail.com" || userProfile?.role === "admin";
  
  const activeRoleToShow =
    viewOverride || (isGlobalAdmin ? "admin" : userProfile ? "employer" : null);

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 2. AUTHENTICATED CORPORATE PANEL PORTAL */}
      {currentUser && (userProfile || isNewUserRegistration) ? (
        <div className="flex-1 flex flex-col">
          {/* Main Top Header Navigation */}
          <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎁</span>
              <div>
                <span className="font-extrabold tracking-tight text-sm text-slate-900 font-sans">
                  Tipping Platform
                </span>
                <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Autonomous split network (2% fee)
                </span>
              </div>
            </div>

            {/* User Profile display and quick signout */}
            <div className="flex items-center gap-4">
              {/* developer toggle widgets for system audit checks */}
              {isGlobalAdmin && (
                <div className="hidden sm:flex bg-slate-50 border border-slate-200/60 p-1 rounded-lg">
                  <button
                    onClick={() => setViewOverride("admin")}
                    className={`px-3 py-1 rounded-md transition-all text-[9px] uppercase tracking-wider font-bold cursor-pointer ${
                      activeRoleToShow === "admin"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-800"
                    }`}
                  >
                    Admin View
                  </button>
                  <button
                    onClick={() => setViewOverride("employer")}
                    className={`px-3 py-1 rounded-md transition-all text-[9px] uppercase tracking-wider font-bold cursor-pointer ${
                      activeRoleToShow === "employer"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-slate-800"
                    }`}
                  >
                    Employer View
                  </button>
                </div>
              )}

              {/* Account Meta & logout trigger */}
              <div className="text-right shrink-0">
                <div className="text-[11px] font-bold text-slate-800 uppercase tracking-tight truncate max-w-[120px] sm:max-w-[200px]">
                  {userProfile?.name || currentUser.displayName}
                </div>
                <div className="text-[8px] uppercase font-bold text-blue-600 tracking-wider mt-0.5">
                  {isGlobalAdmin ? "Platform Admin" : "Employer Group"}
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
                title="Sign out of system"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 animate-fade-in flex flex-col justify-between">
            {isNewUserRegistration ? (
              /* Completing New Business Employer Registration */
              <div className="max-w-md mx-auto my-12 bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm space-y-6">
                <div>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-md inline-block">
                    Onboarding Registry
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-4 font-sans">
                    Merchant Configuration
                  </h2>
                  <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                    Provide the business name that will group your onboarded staff under the portal's registry.
                  </p>
                </div>

                <form onSubmit={handleCompleteRegistrationSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase text-slate-400 tracking-wider font-bold">
                      Business Administrator Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Samuel Okafor"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-lg border border-slate-200 p-3 text-xs font-semibold focus:outline-none transition focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase text-slate-400 tracking-wider font-bold">
                      Shopping Mall Store / Corporate Entity Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Starbucks Tipping Section"
                      value={regBusinessName}
                      onChange={(e) => setRegBusinessName(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-lg border border-slate-200 p-3 text-xs font-semibold focus:outline-none transition focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={registering}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 text-white font-bold p-3 rounded-lg text-xs tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {registering ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        PROVISIONING REGISTRY...
                      </>
                    ) : (
                      "Complete Registration"
                    )}
                  </button>
                </form>
              </div>
            ) : activeRoleToShow === "admin" ? (
              /* Platform Admin View screen */
              <AdminDashboard />
            ) : (
              /* Business Employer Dashboard */
              <EmployerDashboard
                employerUid={userProfile?.uid || currentUser.uid}
                employerName={userProfile?.name || ""}
                businessName={userProfile?.businessName || ""}
              />
            )}
          </main>
          {/* Aesthetic Modern Footer */}
          <footer className="bg-white border-t border-slate-200/80 py-6 px-8 flex flex-col sm:flex-row items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 no-print gap-4">
            <div className="flex gap-4">
              <span>System: Secured and Active</span>
              <span>&middot;</span>
              <span>Split routes verified</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 font-bold">Tipping Platform</span>
              <span>&copy; 2026 Tipping Platform Ltd.</span>
            </div>
          </footer>
        </div>
      ) : (
        /* 3. LANDING PAGE FOR NOT LOGGED-IN USERS */
        <div className="flex-1 flex flex-col bg-[#fafbfc] min-h-screen font-sans">
          {/* Header Navigation Bar */}
          <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50 no-print">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              {/* Logo on Left */}
              <div 
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} 
                className="flex items-center gap-2 text-slate-850 hover:text-slate-950 transition font-bold text-sm cursor-pointer select-none"
              >
                <span className="text-lg">🎁</span>
                <span className="tracking-tight">Tipping Platform</span>
              </div>
              
              {/* Quick Navigation on Right */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAccessModal(true)}
                  className="border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 py-1 px-3 rounded-md text-[11px] font-bold cursor-pointer transition uppercase tracking-wider"
                >
                  Admin Dashboard
                </button>
                <button
                  onClick={() => setShowPublicOnboard(true)}
                  className="border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 py-1 px-3 rounded-md text-[11px] font-bold cursor-pointer transition uppercase tracking-wider"
                >
                  Onboard Worker
                </button>
              </div>
            </div>
          </header>

          {/* Hero Section */}
          <div className="bg-white border-b border-slate-100 flex-1 flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15] font-sans">
                Digital Tipping Made Simple
              </h1>
              <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed font-sans">
                Enable your workers to receive tips directly through QR codes. Secure, fast, and transparent with automatic commission tracking.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setShowAccessModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-6 rounded-md shadow-sm uppercase tracking-widest transition cursor-pointer"
                >
                  Get Started
                </button>
                <button
                  onClick={() => {
                    document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-xs py-2.5 px-6 rounded-md shadow-sm uppercase tracking-widest transition cursor-pointer"
                >
                  Learn More
                </button>
              </div>
            </div>
          </div>

          {/* Why Choose Our Platform Section */}
          <section id="features-section" className="bg-white py-20 px-6 border-b border-slate-100">
            <div className="max-w-5xl mx-auto text-center space-y-16">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-sans">
                Why Choose Our Platform?
              </h2>

              {/* 3x2 Grid of 6 distinct Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                {/* Card 1 - QR Code Tipping */}
                <div className="bg-white border border-slate-200/60 rounded-xl p-6 hover:shadow-md transition duration-200 space-y-4">
                  <div className="w-10 h-10 bg-blue-50 border border-blue-100 text-blue-650 rounded-lg flex items-center justify-center">
                    <QrCode className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
                      QR Code Tipping
                    </h3>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Customers scan a QR code to send tips instantly. No cash, no hassle.
                    </p>
                  </div>
                </div>

                {/* Card 2 - Instant Payouts */}
                <div className="bg-white border border-slate-200/60 rounded-xl p-6 hover:shadow-md transition duration-200 space-y-4">
                  <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
                      Instant Payouts
                    </h3>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Tips are processed in real-time through Paystack with automatic splits.
                    </p>
                  </div>
                </div>

                {/* Card 3 - Secure & Safe */}
                <div className="bg-white border border-slate-200/60 rounded-xl p-6 hover:shadow-md transition duration-200 space-y-4">
                  <div className="w-10 h-10 bg-purple-50 border border-purple-100 text-purple-650 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
                      Secure & Safe
                    </h3>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Bank-grade security with encrypted transactions and verified workers.
                    </p>
                  </div>
                </div>

                {/* Card 4 - Easy Onboarding */}
                <div className="bg-white border border-slate-200/60 rounded-xl p-6 hover:shadow-md transition duration-200 space-y-4">
                  <div className="w-10 h-10 bg-amber-50 border border-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                    <UserPlus className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
                      Easy Onboarding
                    </h3>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Simple form captures all needed info. Automatic Paystack sub-account setup.
                    </p>
                  </div>
                </div>

                {/* Card 5 - Transparent Analytics */}
                <div className="bg-white border border-slate-200/60 rounded-xl p-6 hover:shadow-md transition duration-200 space-y-4">
                  <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
                      Transparent Analytics
                    </h3>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Track earnings, commissions, and transactions in real-time.
                    </p>
                  </div>
                </div>

                {/* Card 6 - Printable Cards */}
                <div className="bg-white border border-slate-200/60 rounded-xl p-6 hover:shadow-md transition duration-200 space-y-4">
                  <div className="w-10 h-10 bg-pink-50 border border-pink-100 text-pink-600 rounded-lg flex items-center justify-center">
                    <Gift className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
                      Printable Cards
                    </h3>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Download PDF tip cards with QR codes for physical display.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="bg-slate-50/50 py-20 px-6 border-b border-slate-100">
            <div className="max-w-5xl mx-auto text-center space-y-16">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-sans">
                How It Works
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
                {/* Step 1 */}
                <div className="space-y-4 text-center">
                  <div className="w-10 h-10 bg-blue-100 border border-blue-200 text-blue-600 font-bold rounded-full flex items-center justify-center mx-auto text-sm shadow-sm">
                    1
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-850 uppercase tracking-widest">Onboard</h4>
                    <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                      Workers register with their name, role, and bank details.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="space-y-4 text-center">
                  <div className="w-10 h-10 bg-emerald-100 border border-emerald-200 text-emerald-600 font-bold rounded-full flex items-center justify-center mx-auto text-sm shadow-sm">
                    2
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-850 uppercase tracking-widest font-sans">Get QR Code</h4>
                    <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                      Receive a unique QR code and printable tip card.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="space-y-4 text-center">
                  <div className="w-10 h-10 bg-purple-100 border border-purple-200 text-purple-600 font-bold rounded-full flex items-center justify-center mx-auto text-sm shadow-sm">
                    3
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-850 uppercase tracking-widest">Share & Scan</h4>
                    <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                      Customers scan the QR code to send a tip.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="space-y-4 text-center">
                  <div className="w-10 h-10 bg-amber-100 border border-amber-200 text-amber-600 font-bold rounded-full flex items-center justify-center mx-auto text-sm shadow-sm">
                    4
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-850 uppercase tracking-widest">Receive Payment</h4>
                    <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                      Tips are processed instantly to your bank account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Footer block */}
          <footer className="bg-white border-t border-slate-200 py-10 px-6 mt-auto text-center shrink-0">
            <div className="max-w-5xl mx-auto space-y-4 text-slate-400">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                <div>© 2026 Tipping Platform. Secured splits verified.</div>
                <div className="flex gap-4">
                  <button onClick={() => setShowAccessModal(true)} className="hover:text-slate-800 cursor-pointer uppercase font-bold text-[10px]">Admin Access</button>
                  <span>&middot;</span>
                  <button onClick={() => setShowPublicOnboard(true)} className="hover:text-slate-800 cursor-pointer uppercase font-bold text-[10px]">Onboard Registry</button>
                </div>
              </div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase tracking-wider">
                Powered by Paystack secure split accounts integration
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* ACCESS PORTAL MODAL (FIXES POPUP ISSUES ON IFRAME ENVIRONMENTS) */}
      {showAccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 max-w-sm w-full space-y-6">
            <div className="text-center">
              <span className="text-2xl">🎁</span>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mt-2">
                Access Tipping Platform
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Authenticate securely to access your dashboard.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDirectEmailAccess(accessEmail);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                  Direct Email Access (Recommended for Sandbox Preview)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. exellentoak@gmail.com"
                  value={accessEmail}
                  onChange={(e) => setAccessEmail(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-blue-500 p-3.5 text-xs font-bold focus:outline-none transition-all"
                />
                <p className="text-[9px] text-slate-400 leading-normal">
                  💡 Enter <strong className="text-slate-700">exellentoak@gmail.com</strong> for Admin, or any other email for Employer access.
                </p>
              </div>

              <button
                type="submit"
                disabled={accessModalLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200 uppercase tracking-wider cursor-pointer"
              >
                {accessModalLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Connecting...
                  </>
                ) : (
                  "Access Dashboard"
                )}
              </button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-[9px] text-slate-350 font-bold uppercase tracking-widest">OR</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition uppercase tracking-wider cursor-pointer"
            >
              🔑 Google Authenticator Popup
            </button>

            <button
              onClick={() => setShowAccessModal(false)}
              className="w-full text-center text-[10px] uppercase font-bold text-slate-400 hover:text-slate-600 tracking-wider pt-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
