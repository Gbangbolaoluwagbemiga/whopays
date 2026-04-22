"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Plus, BrainCircuit, ArrowRight, Wallet, CheckCircle2 } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface Expense {
  id: string;
  payer: string;
  amount: number;
  description: string;
  date: string;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export default function GroupTabsPage() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);

  const expenses: Expense[] = [
    { id: "1", payer: "Alice", amount: 120.00, description: "Dinner at Luigi's", date: "May 2" },
    { id: "2", payer: "Bob", amount: 45.50, description: "Uber to Airport", date: "May 3" },
    { id: "3", payer: "Charlie", amount: 300.00, description: "Airbnb Deposit", date: "May 4" },
    { id: "4", payer: "You", amount: 80.00, description: "Groceries", date: "May 5" },
  ];

  const handleCalculate = () => {
    setIsCalculating(true);
    // Simulate AI Debt Graph simplification
    setTimeout(() => {
      setIsCalculating(false);
      setSettlements([
        { from: "You", to: "Charlie", amount: 56.37 },
        { from: "Bob", to: "Charlie", amount: 90.87 },
        { from: "Alice", to: "Charlie", amount: 16.37 },
      ]);
    }, 2500);
  };

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <main className="min-h-screen flex flex-col p-4 sm:p-8 w-full max-w-2xl mx-auto">
      <header className="w-full flex justify-between items-center mb-10">
        <Link 
          href="/"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-bold text-sm tracking-wider uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Lobby
        </Link>
        <ConnectButton showBalance={false} />
      </header>

      <div className="flex flex-col flex-1 space-y-8 pb-20">
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <div className="w-16 h-16 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center">
            <History className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Bali Trip 2026</h1>
            <p className="text-gray-400 font-medium">Group Tab • 4 Members</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-5 rounded-2xl border border-white/5">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Total Spent</p>
            <p className="text-2xl font-black text-white">${totalSpent.toFixed(2)}</p>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-white/5 bg-blue-500/5 border-blue-500/20">
            <p className="text-xs font-black text-blue-400/70 uppercase tracking-widest mb-1">Your Share</p>
            <p className="text-2xl font-black text-blue-400">${(totalSpent / 4).toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest">Recent Expenses</h3>
            <button className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-black text-xs text-gray-400 border border-white/10">
                    {exp.payer[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-200">{exp.description}</p>
                    <p className="text-xs text-gray-500 font-medium">Paid by <span className="text-gray-300">{exp.payer}</span> • {exp.date}</p>
                  </div>
                </div>
                <span className="font-black text-white">${exp.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {!settlements && (
          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest disabled:opacity-50 hover:bg-blue-500 transition-colors shadow-[0_0_20px_rgba(37,99,235,0.4)] mt-4"
          >
            {isCalculating ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <BrainCircuit className="w-5 h-5" />
            )}
            {isCalculating ? "Optimizing Debt Graph..." : "Calculate AI Settlement"}
          </button>
        )}

        {settlements && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="glass-card p-6 rounded-[2rem] border border-emerald-500/30 space-y-6 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
              <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Optimized Settlement Paths</h3>
              </div>
              
              <div className="space-y-4">
                {settlements.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <span className={`font-bold ${s.from === 'You' ? 'text-blue-400' : 'text-gray-300'}`}>{s.from}</span>
                      <ArrowRight className="w-4 h-4 text-gray-600" />
                      <span className="font-bold text-gray-300">{s.to}</span>
                    </div>
                    <span className="font-black text-emerald-400">${s.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Wallet className="w-5 h-5" /> Execute Transfers via MiniPay
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
