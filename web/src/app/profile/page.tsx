import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { ArrowLeft, User as UserIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (address) {
        fetchProfile();
    }
  }, [address]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("wallet_address", address?.toLowerCase())
        .single();
    
    if (data) {
        setDisplayName(data.display_name || "");
    }
  };

  const handleSaveName = async () => {
    if (!address) return;
    setIsSaving(true);
    try {
        const { error } = await supabase
            .from("user_profiles")
            .upsert({ 
                wallet_address: address.toLowerCase(), 
                display_name: displayName,
                updated_at: new Date().toISOString()
            }, { onConflict: "wallet_address" });
        
        if (error) throw error;
        toast.success("Name updated!");
    } catch (e: any) {
        console.error(e);
        toast.error("Failed to save name");
    } finally {
        setIsSaving(false);
    }
  };

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

      <div className="flex flex-col items-center justify-center flex-1 space-y-8 pb-20">
        <div className="w-20 h-20 bg-purple-500/20 border border-purple-500/30 rounded-full flex items-center justify-center">
          <UserIcon className="w-10 h-10 text-purple-400" />
        </div>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Your Profile</h1>
        
        {!isConnected ? (
          <p className="text-gray-400 font-medium">Please connect your wallet to view your badges.</p>
        ) : (
          <div className="w-full space-y-12">
            <div className="glass-card p-8 border-white/5 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Identity</h2>
                </div>
                <div>
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-2 px-1">Display Name</label>
                    <div className="flex gap-2">
                        <input 
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. Satoshi"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-yellow-500 transition-all"
                        />
                        <button 
                            onClick={handleSaveName}
                            disabled={isSaving}
                            className="px-6 py-3 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSaving ? "..." : "Save"}
                        </button>
                    </div>
                </div>
                <div className="pt-4 border-t border-white/5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1 px-1">Wallet Address</p>
                    <p className="text-xs font-mono text-gray-400 bg-white/5 p-3 rounded-lg border border-white/5 break-all">{address}</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Reputation Badges</h2>
                </div>
                <div className="w-full">
                    <BadgeDisplay address={address} />
                </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
