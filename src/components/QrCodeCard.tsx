import { Printer, Download } from "lucide-react";
import { Worker } from "../types";

interface QrCodeCardProps {
  worker: Worker;
}

export default function QrCodeCard({ worker }: QrCodeCardProps) {
  // Construct the URL that clients scan to reach this worker's tip page, packing core payment coordinates for absolute network resilience
  const pageUrl = `${window.location.origin}/?worker=${worker.id}&name=${encodeURIComponent(worker.name)}&pos=${encodeURIComponent(worker.position)}&sub=${encodeURIComponent(worker.subaccountCode)}${worker.employerName ? `&empName=${encodeURIComponent(worker.employerName)}` : ""}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    pageUrl
  )}`;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Staff Tipping Card - ${worker.name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#f8fafc] flex items-center justify-center min-h-screen p-4">
          <div class="bg-white border border-slate-100 rounded-3xl p-8 max-w-sm w-full text-center shadow-xl relative overflow-hidden">
            <div class="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block mb-3">Tipping Portal</div>
            <h1 class="text-xl font-extrabold text-slate-900 tracking-tight font-sans">SUPPORT OUR TEAM</h1>
            <div class="h-px bg-slate-100 w-full my-4"></div>
            
            <p class="text-slate-500 text-[11px] mb-6 leading-relaxed">Scan the secure QR code using your phone camera to leave a secure direct tip to our team member.</p>
            
            <div class="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200 inline-block mb-6">
              <img src="${qrImageUrl}" alt="Scan QR Code to Tip" class="w-60 h-60 mx-auto" />
            </div>

            <div class="bg-slate-900 text-white p-5 rounded-2xl text-left relative overflow-hidden">
              <div class="text-sm font-bold tracking-normal uppercase text-white">${worker.name}</div>
              <div class="text-[9px] uppercase tracking-wider text-blue-400 font-bold mt-0.5">${worker.position}</div>
            </div>

            <div class="mt-6 text-[9px] text-slate-400 font-mono tracking-tight">
              Platform Settlement: SUBCNT CODE [${worker.subaccountCode}]
            </div>
            
            <button onclick="window.print()" class="no-print mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] tracking-wider uppercase px-5 py-3 rounded-xl transition cursor-pointer">
              Print Card
            </button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm text-center relative overflow-hidden">
      <div className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block mb-2">
        Staff QR Standee
      </div>
      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Tipping Point QR</h3>
      <div className="h-px bg-slate-100 w-full my-3"></div>

      <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 inline-block my-2">
        <img
          src={qrImageUrl}
          alt="Scan QR"
          className="w-48 h-48 mx-auto"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="bg-slate-900 text-white p-4 rounded-xl mt-3.5 text-left relative overflow-hidden">
        <h4 className="text-xs font-bold uppercase tracking-normal truncate">{worker.name}</h4>
        <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider mt-0.5 animate-pulse">
          {worker.position}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 no-print">
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider py-3 px-3 rounded-xl transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          Print Card
        </button>
        <a
          href={qrImageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700 text-[10px] font-bold uppercase tracking-wider py-3 px-3 rounded-xl transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Get QR
        </a>
      </div>
      <div className="mt-4 text-[9px] text-slate-400 font-mono tracking-tight select-all truncate">
        Scan link: {pageUrl}
      </div>
    </div>
  );
}
