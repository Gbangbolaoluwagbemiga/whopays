"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Upload, ScanLine, Users, Receipt, AlertCircle, Loader2, CheckCircle2, X } from "lucide-react";

interface ParsedItem {
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[];
}

interface ScanResult {
  restaurant: string;
  total: number;
  currency: string;
  items: ParsedItem[];
}

export default function ReceiptScannerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [squad, setSquad] = useState<string[]>(["You"]);
  const [newMember, setNewMember] = useState("");
  const [splitSummary, setSplitSummary] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setScanResult(null);
    setScanError(null);
    setSplitSummary(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleScan = async () => {
    if (!file) return;
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);
    setSplitSummary(null);

    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const res = await fetch("/api/scan-receipt", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        setScanError(data.error || "Could not read receipt. Please try a clearer photo.");
        return;
      }

      // Initialize items with nobody assigned
      const items: ParsedItem[] = data.items.map((item: any) => ({
        ...item,
        assignedTo: [],
      }));

      setScanResult({ ...data, items });
    } catch {
      setScanError("Network error. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const toggleAssignment = (itemIndex: number, user: string) => {
    if (!scanResult) return;
    const newItems = [...scanResult.items];
    const item = { ...newItems[itemIndex] };
    if (item.assignedTo.includes(user)) {
      item.assignedTo = item.assignedTo.filter((u) => u !== user);
    } else {
      item.assignedTo = [...item.assignedTo, user];
    }
    newItems[itemIndex] = item;
    setScanResult({ ...scanResult, items: newItems });
  };

  const addMember = () => {
    const trimmed = newMember.trim();
    if (trimmed && !squad.includes(trimmed)) {
      setSquad([...squad, trimmed]);
      setNewMember("");
    }
  };

  const removeMember = (name: string) => {
    if (name === "You") return;
    setSquad(squad.filter((m) => m !== name));
    // Remove from assignments
    if (scanResult) {
      const newItems = scanResult.items.map((item) => ({
        ...item,
        assignedTo: item.assignedTo.filter((u) => u !== name),
      }));
      setScanResult({ ...scanResult, items: newItems });
    }
  };

  const generateSplit = () => {
    if (!scanResult) return;
    const totals: Record<string, number> = {};
    squad.forEach((m) => (totals[m] = 0));

    for (const item of scanResult.items) {
      if (item.assignedTo.length === 0) continue;
      const share = item.price / item.assignedTo.length;
      item.assignedTo.forEach((user) => {
        totals[user] = (totals[user] || 0) + share;
      });
    }

    setSplitSummary(totals);
  };

  const unassignedItems = scanResult?.items.filter((i) => i.assignedTo.length === 0) || [];

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0c] text-white pb-20">
      {/* Header */}
      <header className="w-full sticky top-0 z-10 backdrop-blur-xl bg-black/40 border-b border-white/5 px-5 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-bold text-sm uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <Camera className="w-4 h-4 text-purple-400" />
          </div>
          <span className="font-black text-white text-lg">AI Receipt Scanner</span>
        </div>
        <div className="w-16" />
      </header>

      <div className="flex flex-col items-center px-4 sm:px-6 pt-8 gap-6 w-full max-w-xl mx-auto">

        {/* STEP 1 — Add Squad */}
        <div className="w-full glass-card p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">1</span>
            <h3 className="font-black text-white text-sm uppercase tracking-widest">Add Your Squad</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {squad.map((member) => (
              <div key={member} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${member === "You" ? "bg-blue-600/20 border-blue-500/30 text-blue-300" : "bg-white/5 border-white/10 text-gray-300"}`}>
                {member}
                {member !== "You" && (
                  <button onClick={() => removeMember(member)} className="text-gray-500 hover:text-white transition-colors ml-1">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              placeholder="Add person (e.g. Alice)..."
              className="flex-1 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/60 transition-all"
            />
            <button onClick={addMember} className="px-4 py-2 bg-purple-600 rounded-xl text-white text-sm font-bold hover:bg-purple-500 transition-colors">
              Add
            </button>
          </div>
        </div>

        {/* STEP 2 — Upload Receipt */}
        <div className="w-full glass-card p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">2</span>
            <h3 className="font-black text-white text-sm uppercase tracking-widest">Upload Receipt</h3>
          </div>

          <label className="w-full cursor-pointer group block" onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            {preview ? (
              <div className="relative w-full rounded-2xl overflow-hidden border border-purple-500/40">
                <img src={preview} alt="Receipt preview" className="w-full object-contain max-h-64" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-bold text-sm bg-black/60 px-3 py-1 rounded-full">Tap to change</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-44 rounded-2xl border-2 border-dashed border-white/20 group-hover:border-purple-400/50 flex flex-col items-center justify-center gap-3 transition-all group-hover:bg-white/5">
                <Upload className="w-10 h-10 text-gray-500 group-hover:text-purple-400 transition-colors" />
                <div className="text-center">
                  <p className="text-gray-400 font-medium text-sm">Tap to upload receipt photo</p>
                  <p className="text-gray-600 text-xs mt-1">Works best with clear, well-lit photos</p>
                </div>
              </div>
            )}
          </label>

          <button
            onClick={handleScan}
            disabled={!file || isScanning}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest disabled:opacity-40 hover:bg-purple-500 transition-colors shadow-[0_0_20px_rgba(168,85,247,0.4)]"
          >
            {isScanning ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Scanning with AI...</>
            ) : (
              <><ScanLine className="w-5 h-5" /> Scan Receipt</>
            )}
          </button>

          {scanError && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{scanError}</p>
            </div>
          )}
        </div>

        {/* STEP 3 — Assign Items */}
        {scanResult && (
          <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-400">
            <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">3</span>
                  <h3 className="font-black text-white text-sm uppercase tracking-widest">Assign Items</h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{scanResult.restaurant}</p>
                  <p className="text-lg font-black text-emerald-400">${scanResult.total.toFixed(2)}</p>
                </div>
              </div>

              {unassignedItems.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <p className="text-xs text-yellow-300">{unassignedItems.length} item(s) not assigned yet</p>
                </div>
              )}

              <div className="space-y-3">
                {scanResult.items.map((item, index) => (
                  <div key={index} className={`p-4 rounded-2xl border transition-all ${item.assignedTo.length > 0 ? "bg-white/5 border-white/10" : "bg-black/20 border-dashed border-white/10"}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-200 text-sm">{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</span>
                      <span className="font-black text-white">${item.price.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {squad.map((user) => {
                        const assigned = item.assignedTo.includes(user);
                        return (
                          <button
                            key={user}
                            onClick={() => toggleAssignment(index, user)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${assigned ? "bg-purple-600 text-white shadow-md" : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300"}`}
                          >
                            {assigned && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                            {user}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={generateSplit}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)]"
            >
              <Users className="w-5 h-5" /> Calculate Split
            </button>

            {/* Split Summary */}
            {splitSummary && (
              <div className="glass-card p-5 rounded-2xl border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.1)] space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h3 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Your Split
                </h3>
                <div className="space-y-3">
                  {Object.entries(splitSummary).map(([user, amount]) => (
                    <div key={user} className="flex justify-between items-center p-3 bg-black/20 rounded-xl border border-white/5">
                      <span className={`font-bold ${user === "You" ? "text-blue-400" : "text-gray-200"}`}>{user}</span>
                      <span className="font-black text-emerald-400 text-lg">${amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <button className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-500 transition-colors">
                  🚀 Request Payments via WhoPays
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
