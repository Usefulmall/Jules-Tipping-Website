import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Parse JSON body
app.use(express.json());

// List of mock banks as absolute fallback or if PAYSTACK_SECRET_KEY is missing (South African focus)
const FALLBACK_BANKS = [
  { name: "Capitec Bank Limited", code: "470010" },
  { name: "First National Bank", code: "250655" },
  { name: "Standard Bank South Africa", code: "051001" },
  { name: "Nedbank", code: "198765" },
  { name: "Absa Bank Limited", code: "632005" },
  { name: "TymeBank", code: "678910" },
  { name: "African Bank Limited", code: "430000" },
  { name: "Discovery Bank Limited", code: "679000" }
];

// Helper to guarantee valid bank code maps for South African banks
function sanitizeBankCode(code: string): string {
  if (!code) return code;
  const normalized = code.trim().toLowerCase().replace(/_/g, "-");
  
  const mapping: { [key: string]: string } = {
    "standard-bank": "051001",
    "standard-bank-za": "051001",
    "standard-bank-of-south-africa": "051001",
    "standard-bank-south-africa": "051001",
    "capitec-bank": "470010",
    "capitec": "470010",
    "capitec-bank-za": "470010",
    "capitec-bank-limited": "470010",
    "first-national-bank": "250655",
    "fnb": "250655",
    "first-national-bank-fnb": "250655",
    "first-national-bank-za": "250655",
    "nedbank": "198765",
    "nedbank-za": "198765",
    "absa-bank": "632005",
    "absa": "632005",
    "absa-za": "632005",
    "tyme-bank": "678910",
    "tymebank": "678910",
    "tyme-bank-za": "678910",
    "african-bank": "430000",
    "african-bank-za": "430000",
    "discovery-bank": "679000",
    "discovery-bank-za": "679000"
  };

  return mapping[normalized] || code;
}

// 1. Fetch Banks List
app.get("/api/paystack/banks", async (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.log("[Paystack] PAYSTACK_SECRET_KEY is missing. Using local mock banks list.");
    return res.json({ status: true, data: FALLBACK_BANKS });
  }

  try {
    // Explicitly querying South African banks
    const response = await fetch("https://api.paystack.co/bank?country=south%20africa", {
      headers: {
        Authorization: `Bearer ${secretKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Paystack bank API returned ${response.status}`);
    }

    const result = await response.json();
    if (result && result.status && Array.isArray(result.data) && result.data.length > 0) {
      return res.json(result);
    } else {
      console.log("[Paystack] Empty or failed bank response from API, cascading to FALLBACK_BANKS.");
      return res.json({ status: true, data: FALLBACK_BANKS });
    }
  } catch (error) {
    console.error("[Paystack] Error fetching banks from Paystack. Cascading to fallback list:", error);
    return res.json({ status: true, data: FALLBACK_BANKS });
  }
});

// 2. Resolve Bank Account Name
app.post("/api/paystack/verify-account", async (req, res) => {
  const { accountNumber, bankCode } = req.body;
  if (!accountNumber || !bankCode) {
    return res.status(400).json({ status: false, message: "Missing accountNumber or bankCode" });
  }

  const sanitizedBankCode = sanitizeBankCode(bankCode);
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.log("[Paystack] PAYSTACK_SECRET_KEY is missing. Mock verification succeeded.");
    // Return a beautiful mock verified account name based on account number digits
    const seed = accountNumber.split("").reduce((acc: number, val: string) => acc + parseInt(val || "0", 10), 0);
    const mockNames = [
      "SIPHO NGWENYA",
      "LINDIWE DLAMINI",
      "FRANCOIS DU TOIT",
      "THABO MOKOENA",
      "JOHANNA BOTHA",
      "NUR ADAMS",
      "SIYABONGA KHUMALO",
      "WILLEM VAN DER MERWE"
    ];
    const mockName = mockNames[seed % mockNames.length];
    return res.json({
      status: true,
      message: "Account number resolved",
      data: {
        account_number: accountNumber,
        account_name: mockName,
        bank_id: parseInt(sanitizedBankCode, 10) || 1
      }
    });
  }

  try {
    const queryParams = new URLSearchParams({
      account_number: accountNumber,
      bank_code: sanitizedBankCode
    });
    const response = await fetch(`https://api.paystack.co/bank/resolve?${queryParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`
      }
    });

    const result = await response.json();
    if (!response.ok || !result.status) {
      return res.status(400).json({
        status: false,
        message: result.message || "Could not resolve bank account details securely"
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("[Paystack] Error resolving account:", error);
    return res.status(500).json({ status: false, message: "Internal server error during account check" });
  }
});

// 3. Create Split Subaccount
// Worker receives 98%, Platform receives 2%.
// Paystack subaccount API creates a subaccount. If successful, it automatically splits payments to this subaccount.
// We pass percentage_charge: 2 (which means 2% fee goes to primary integration owner, and 98% goes to subaccount)
app.post("/api/paystack/create-subaccount", async (req, res) => {
  const { businessName, settlementBank, accountNumber } = req.body;
  if (!businessName || !settlementBank || !accountNumber) {
    return res.status(400).json({ status: false, message: "Missing subaccount creation parameters" });
  }

  const sanitizedBankCode = sanitizeBankCode(settlementBank);
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.log("[Paystack] PAYSTACK_SECRET_KEY is missing. Simulating subaccount creation...");
    const mockSubaccountCode = `ACCT_mock_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    return res.json({
      status: true,
      message: "Subaccount created successfully",
      data: {
        id: Math.floor(Math.random() * 1000000),
        subaccount_code: mockSubaccountCode,
        business_name: businessName,
        settlement_bank: sanitizedBankCode,
        account_number: accountNumber,
        percentage_charge: 2,
        is_mock: true
      }
    });
  }

  try {
    const payload = {
      business_name: businessName,
      settlement_bank: sanitizedBankCode,
      account_number: accountNumber,
      percentage_charge: 2 // Platform retains 2% platform fee autonomously
    };

    const response = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok || !result.status) {
      return res.status(400).json({
        status: false,
        message: result.message || "Failed to create Paystack subaccount"
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("[Paystack] Subaccount API Error:", error);
    return res.status(500).json({ status: false, message: "Failed to communicate with Paystack server" });
  }
});

// Dynamic Vite Asset Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Tipping Platform] Server running at http://localhost:${PORT}`);
  });
}

startServer();
