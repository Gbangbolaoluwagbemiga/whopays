"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Trophy, Users, Clock, Zap, CheckCircle2,
  BrainCircuit, Loader2, Plus, X, AlertCircle, Coins,
  ExternalLink,
  ShieldCheck,
  Share2,
  Copy,
  Check
} from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts, useWatchContractEvent, usePublicClient } from "wagmi";
import { parseEther, formatEther, decodeEventLog } from "viem";
import { useSearchParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ESCROW_ADDRESS, ESCROW_ABI, SUPPORTED_TOKENS, TOKEN_ABI } from "@/constants/contracts";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";

type BetStatus = "setup" | "waiting" | "locked" | "resolved" | "cancelled";

interface Party {
  name: string;
  address: `0x${string}`;
}

interface AiVerdict {
  resolved: boolean;
  outcome: string;
  confidence: string;
  explanation: string;
  canDeclareWinner: boolean;
}

export default function BetsPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<"home" | "create" | "active">("home");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stake, setStake] = useState("0.1");
  const [duration, setDuration] = useState("24");
  const [parties, setParties] = useState<Party[]>([
    { name: "You", address: address as `0x${string}` },
  ]);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyAddr, setNewPartyAddr] = useState("");
  const [activeBetId, setActiveBetId] = useState<string | null>(null);
  const [userClaim, setUserClaim] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [verdict, setVerdict] = useState<AiVerdict | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [selectedToken, setSelectedToken] = useState(SUPPORTED_TOKENS[0]);
  const [betType, setBetType] = useState<"local" | "universal">("local");

  const { writeContract, data: hash, isPending: isTxPending } = useWriteContract();
  const { data: receipt, isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash });

  // 1. Listen for successful creation via receipt logs (More reliable than passive watch)
  useEffect(() => {
    if (isTxSuccess && receipt) {
      toast.success("Transaction confirmed on Celo Mainnet! 🎉");
      // Find the BetCreated event in logs
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: ESCROW_ABI,
            data: log.data,
            topics: log.topics,
          });

          if (event.eventName === "BetCreated") {
            const newBetId = (event.args as any).betId;
            setActiveBetId(newBetId);
            setStep("active");
            router.push(`/bets?id=${newBetId}`);
            break;
          }
        } catch (e) {
          // Skip logs that don't match the ABI
          continue;
        }
      }
    }
  }, [isTxSuccess, receipt]);

  // Keep passive watch as a fallback for external joins
  useWatchContractEvent({
    address: ESCROW_ADDRESS as `0x${string}`,
    abi: ESCROW_ABI,
    eventName: "BetCreated",
    onLogs(logs: any) {
      const log = logs[0];
      if (log && log.args.creator.toLowerCase() === address?.toLowerCase()) {
        const newBetId = log.args.betId;
        setActiveBetId(newBetId);
        setStep("active");
        router.push(`/bets?id=${newBetId}`);
      }
    },
  });

  // 1. Fetch Bet Data from Contract
  const { data: betInfo, refetch: refetchBet } = useReadContract({
    address: ESCROW_ADDRESS as `0x${string}`,
    abi: ESCROW_ABI,
    functionName: "getBetInfo",
    args: activeBetId ? [activeBetId as `0x${string}`] : undefined,
    query: { enabled: !!activeBetId, refetchInterval: 3000 }
  });

  const { data: contractParties } = useReadContract({
    address: ESCROW_ADDRESS as `0x${string}`,
    abi: ESCROW_ABI,
    functionName: "getParties",
    args: activeBetId ? [activeBetId as `0x${string}`] : undefined,
    query: { enabled: !!activeBetId }
  });

  const { data: depositStatuses, refetch: refetchDeposits } = useReadContracts({
    contracts: (contractParties || []).map((pAddr: any) => ({
      address: ESCROW_ADDRESS as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: "hasDeposited",
      args: activeBetId ? [activeBetId as `0x${string}`, pAddr] : undefined,
    })),
    query: { enabled: !!contractParties && !!activeBetId }
  } as any);

  const { data: partyClaims } = useReadContracts({
    contracts: (contractParties || []).map((pAddr: any) => ({
      address: ESCROW_ADDRESS as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: "getPartyClaim",
      args: activeBetId ? [activeBetId as `0x${string}`, pAddr] : undefined,
    })),
    query: { enabled: !!contractParties && !!activeBetId }
  } as any);

  // Handle Redirection and Deep Linking
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setActiveBetId(id);
      setStep("active");
    }
  }, [searchParams]);

  useEffect(() => {
    if (isTxSuccess) {
      refetchBet();
      refetchDeposits();
    }
  }, [isTxSuccess]);

  const handleCreateBet = async () => {
    if (!title) {
        toast.error("Please enter a bet title.");
        return;
    }
    if (parties.length < 2) {
        toast.error("Please add at least one friend to the bet.");
        return;
    }
    
    toast.loading("Deploying escrow to Celo Mainnet...", { id: "tx-status" });
    writeContract({
      address: ESCROW_ADDRESS as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: "createBet",
      args: [
        title,
        description,
        BigInt(parseInt(duration) * 3600),
        parties.slice(1).map(p => p.address),
        selectedToken.address as `0x${string}`,
        parseEther(stake),
        betType === "universal",
        userClaim || "General Outcome"
      ],
      value: selectedToken.symbol === "CELO" ? parseEther(stake) : 0n,
    }, {
      onSuccess: () => toast.success("Transaction signed! Waiting for confirmation...", { id: "tx-status" }),
      onError: (err) => toast.error(`Transaction failed: ${err.message}`, { id: "tx-status" })
    });
  };

  const handleJoinBet = async () => {
    if (!activeBetId) return;
    writeContract({
      address: ESCROW_ADDRESS as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: "joinBet",
      args: [activeBetId as `0x${string}`, userClaim || "General Outcome"],
      value: selectedToken.symbol === "CELO" ? (betInfo ? (betInfo as any)[3] : parseEther(stake)) : 0n,
    });
  };

  const handleResolve = async () => {
    if (!activeBetId || !verdict?.outcome) return;
    writeContract({
      address: ESCROW_ADDRESS as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: "resolveBet",
      args: [activeBetId as `0x${string}`, verdict.outcome as `0x${string}`],
    });
  };

  const startAiJudging = async () => {
    if (!activeBetId || !betInfo || !publicClient) return;
    setIsResolving(true);
    try {
      const partiesWithClaims = await Promise.all((contractParties || []).map(async (addr: any) => {
        const claim = await publicClient.readContract({
           address: ESCROW_ADDRESS as `0x${string}`,
           abi: ESCROW_ABI,
           functionName: "getPartyClaim",
           args: [activeBetId as `0x${string}`, addr]
        }) as string;
        return { address: addr, claim };
      }));

      const res = await fetch("/api/resolve-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betId: activeBetId,
          title: (betInfo as any)[1],
          description: (betInfo as any)[2],
          parties: partiesWithClaims,
          isUniversal: (betInfo as any)[7]
        })
      });
      const data = await res.json();
      setVerdict(data);
    } catch (e) {
      toast.error("AI Judge is currently offline.");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-yellow-500/30 selection:text-yellow-200 font-sans">
        <div className="max-w-xl mx-auto px-6 py-12">
            {step === "home" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.3)]">
                            <ShieldCheck className="text-black w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-tight">WhoPays</h1>
                            <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest -mt-1">Mainnet Secured Escrow</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <button 
                            onClick={() => setStep("create")}
                            className="group relative bg-white text-black p-8 rounded-3xl overflow-hidden transition-all hover:scale-[1.02] active:scale-95 shadow-2xl"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Plus className="w-24 h-24" />
                            </div>
                            <div className="relative z-10 text-left">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Start Now</span>
                                <h2 className="text-4xl font-black italic tracking-tighter uppercase mt-1">New Bet</h2>
                                <p className="text-xs font-medium opacity-70 mt-2 max-w-[200px]">Create an escrowed challenge in seconds.</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {step === "create" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <button onClick={() => setStep("home")} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" /> <span className="text-xs font-bold uppercase tracking-widest">Back</span>
                    </button>
                    
                    <div className="space-y-6">
                        <div className="glass-card p-6 border-white/5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Bet Title</label>
                            <input 
                                value={title} 
                                onChange={(e) => setTitle(e.target.value)} 
                                placeholder="Match result bet"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-yellow-500 transition-all placeholder:text-gray-600"
                            />
                        </div>

                        <div className="glass-card p-6 border-white/5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Category</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setBetType("local")}
                                    className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-tighter transition-all ${betType === "local" ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-500"}`}
                                >
                                    Local
                                </button>
                                <button 
                                    onClick={() => setBetType("universal")}
                                    className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-tighter transition-all ${betType === "universal" ? "bg-purple-600 text-white" : "bg-white/5 text-gray-500"}`}
                                >
                                    Universal
                                </button>
                            </div>
                            {betType === "universal" && (
                                <div className="mt-4">
                                    <input 
                                        value={userClaim} 
                                        onChange={(e) => setUserClaim(e.target.value)} 
                                        placeholder="Your prediction (e.g. PSG wins)"
                                        className="w-full bg-purple-600/10 border border-purple-500/30 rounded-xl px-4 py-3 text-sm text-purple-100 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="glass-card p-6 border-white/5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Stake & Asset</label>
                            <div className="flex gap-3">
                                <div className="w-32">
                                    <select 
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm outline-none cursor-pointer"
                                        onChange={(e) => setSelectedToken(SUPPORTED_TOKENS.find(t => t.symbol === e.target.value) || SUPPORTED_TOKENS[0])}
                                    >
                                        {SUPPORTED_TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                                    </select>
                                </div>
                                <input 
                                    type="number" 
                                    value={stake} 
                                    onChange={(e) => setStake(e.target.value)} 
                                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-yellow-500"
                                />
                            </div>
                        </div>

                        <div className="glass-card p-6 border-white/5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Add Participants</label>
                            <div className="flex gap-2 mb-4">
                                <input 
                                    value={newPartyAddr} 
                                    onChange={(e) => setNewPartyAddr(e.target.value)} 
                                    placeholder="Friend's Celo Address (0x...)"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-yellow-500"
                                />
                                <button 
                                    onClick={() => {
                                        if (newPartyAddr.startsWith("0x") && newPartyAddr.length === 42) {
                                            setParties([...parties, { name: "Friend", address: newPartyAddr as `0x${string}` }]);
                                            setNewPartyAddr("");
                                        }
                                    }}
                                    className="w-14 h-14 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all"
                                >
                                    <Plus className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                {parties.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 bg-yellow-500/20 text-yellow-500 rounded-lg flex items-center justify-center text-[8px] font-black">
                                                {i + 1}
                                            </div>
                                            <span className="text-xs font-bold font-mono opacity-80">{p.address.slice(0, 10)}...{p.address.slice(-6)}</span>
                                        </div>
                                        {i > 0 && (
                                            <button onClick={() => setParties(parties.filter((_, idx) => idx !== i))}>
                                                <X className="w-4 h-4 text-gray-500 hover:text-red-500 transition-colors" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={handleCreateBet}
                            disabled={isTxPending || isTxConfirming}
                            className="w-full bg-yellow-500 text-black py-5 rounded-3xl font-black italic tracking-tighter uppercase text-lg shadow-[0_0_50px_rgba(234,179,8,0.2)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {(isTxPending || isTxConfirming) ? <Loader2 className="w-5 h-5 animate-spin" /> : "Deploy & Stake"}
                        </button>
                    </div>
                </div>
            )}

            {step === "active" && activeBetId && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="glass-card p-8 relative overflow-hidden border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.1)]">
                        <div className="flex justify-between items-start mb-6">
                            <div className="px-3 py-1 bg-yellow-500 text-black text-[8px] font-black uppercase tracking-widest rounded-full">
                                {betInfo ? (betInfo as any)[5] === 1 ? "Locked" : "Waiting" : "Loading"}
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Pot</p>
                                <p className="text-2xl font-black italic tracking-tighter text-yellow-500">
                                    {betInfo ? formatEther((betInfo as any)[3] * BigInt((betInfo as any)[4])) : "0.00"} CELO
                                </p>
                            </div>
                        </div>
                        <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">
                            {betInfo ? (betInfo as any)[1] : "Loading Bet..."}
                        </h2>
                        <p className="text-sm text-gray-400 font-medium leading-relaxed">
                            {betInfo ? (betInfo as any)[2] : ""}
                        </p>
                        
                        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Invite Link</p>
                                <p className="text-xs font-mono opacity-40">{typeof window !== 'undefined' ? window.location.href.slice(0, 30) : ""}...</p>
                            </div>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    toast.success("Link copied to clipboard!");
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                            >
                                <Copy className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Copy</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Participants ({contractParties?.length || 0})</p>
                        {(!contractParties || contractParties.length === 0) ? (
                            <div className="glass-card p-8 text-center border-dashed border-white/10">
                                <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                                <p className="text-xs text-gray-500">Retrieving participants from Celo...</p>
                            </div>
                        ) : (
                            (contractParties as any[]).map((pAddr: any, i: number) => {
                            const isMe = address?.toLowerCase() === pAddr.toLowerCase();
                            const hasPaid = depositStatuses?.[i]?.result as boolean;
                            return (
                                <div key={pAddr} className="glass-card p-4 flex items-center justify-between border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${hasPaid ? "bg-green-500/20 text-green-500" : "bg-white/5 text-gray-500"}`}>
                                            {pAddr.slice(2, 4).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white/90">{pAddr.slice(0, 6)}...{pAddr.slice(-4)}</p>
                                            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                                {isMe ? "You" : "Party"} • {hasPaid ? "Staked" : "Waiting"}
                                                {partyClaims?.[i]?.result && (
                                                    <>
                                                        <span className="opacity-30">•</span>
                                                        <span className="text-yellow-500/80">Prediction: {partyClaims[i].result as string}</span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {isMe && !hasPaid && (
                                        <div className="flex flex-col gap-2">
                                            <input 
                                                value={userClaim}
                                                onChange={(e) => setUserClaim(e.target.value)}
                                                placeholder="Your Claim/Prediction"
                                                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] outline-none focus:border-yellow-500"
                                            />
                                            <button 
                                                onClick={handleJoinBet}
                                                className="px-4 py-2 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all"
                                            >
                                                Stake Now
                                            </button>
                                        </div>
                                    )}
                                    {hasPaid && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                </div>
                            );
                        })
                    )}
                    </div>

                    {/* Settlement Phase UI */}
                    {((betInfo as any)?.[5] === 1 || (betInfo as any)?.[5] === "Locked") && (
                        <div className="space-y-6 animate-in zoom-in-95 duration-500 mt-6">
                             {!(betInfo as any)?.[7] && (
                                 <div className="glass-card p-6 border-yellow-500/10 bg-yellow-500/[0.02]">
                                    <div className="flex items-center gap-2 mb-4 text-yellow-500">
                                        <Trophy className="w-4 h-4" />
                                        <h3 className="text-xs font-black uppercase tracking-widest">Settle Winner</h3>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mb-4 uppercase font-bold">Cast your vote for the winner. Consensus releases the pot.</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {(contractParties || []).map((pAddr: any) => (
                                            <button 
                                                key={pAddr}
                                                onClick={() => handleVote(pAddr)}
                                                className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/5 flex items-center justify-between px-4"
                                            >
                                                <span>{pAddr.slice(0, 10)}...{pAddr.slice(-6)}</span>
                                                <div className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-[8px] font-black uppercase rounded-md">Vote for them</div>
                                            </button>
                                        ))}
                                    </div>
                                 </div>
                             )}

                             {(betInfo as any)?.[7] && (
                                <div className="glass-card p-6 border-purple-500/20 bg-purple-500/[0.02]">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2 text-purple-400">
                                            <BrainCircuit className="w-4 h-4" />
                                            <h3 className="text-xs font-black uppercase tracking-widest">WhoPays AI Judge</h3>
                                        </div>
                                        <div className="px-2 py-1 bg-purple-500/20 text-purple-400 text-[8px] font-black uppercase rounded-md tracking-tighter">Autonomous Verdict</div>
                                    </div>
                                    
                                    <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/5">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2">Escrow Logic</p>
                                        <p className="text-[10px] text-gray-300 leading-tight">The AI Agent will browse the internet to verify if the event has occurred and determine the winner based on participant claims.</p>
                                    </div>
                                    
                                    {!verdict ? (
                                        <button 
                                            onClick={startAiJudging}
                                            disabled={isResolving}
                                            className="w-full py-5 bg-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-[0_0_30px_rgba(147,51,234,0.4)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            {isResolving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Result & Payout"}
                                        </button>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="p-5 bg-purple-600/10 border border-purple-500/30 rounded-2xl">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Verdict Reached</p>
                                                </div>
                                                <p className="text-sm font-bold text-white mb-3 leading-snug">{verdict.explanation}</p>
                                                <div className="flex items-center justify-between text-[10px] pt-3 border-t border-purple-500/10">
                                                    <span className="text-gray-500">Confidence: {verdict.confidence}</span>
                                                    <span className="text-purple-400 font-black uppercase">Winner: {verdict.outcome?.slice(0,6)}...{verdict.outcome?.slice(-4)}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={handleResolve}
                                                className="w-full py-5 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-xl"
                                            >
                                                Execute On-Chain Payout
                                            </button>
                                        </div>
                                    )}
                                </div>
                             )}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
}
