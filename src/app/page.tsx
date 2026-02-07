"use client";

import { useWallet } from "@/hooks/useWallet";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { useEffect } from "react";
import WalletStatus from "@/components/WalletStatus";
import Workbench from "@/components/WorkBench";
import { MessageThreadFull } from "@/components/tambo/message-thread-full";

export default function Home() {
  const wallet = useWallet();
  const { isAuthenticated, signIn } = useWalletAuth();

  // Auto sign-in to Supabase when wallet connects
  useEffect(() => {
    if (wallet.connected && wallet.address && !isAuthenticated) {
      signIn().catch(console.error);
    }
  }, [wallet.connected, wallet.address, isAuthenticated, signIn]);

  return (
    <div className="flex flex-col h-screen bg-[#0D0D0F]">
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#2A2A35]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[#E8E8E8]">
            Contract Studio
          </h1>
          <span className="text-xs px-2 py-0.5 rounded bg-[#1A1A20] text-[#00F0FF] border border-[#00F0FF]/20">
            Testnet
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <span className="text-[10px] text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
              ● Synced
            </span>
          )}
          <WalletStatus
            connected={wallet.connected}
            address={wallet.address}
            chainName={wallet.chainName}
            balance={wallet.balance}
            onConnect={wallet.connect}
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[40%] border-r border-[#2A2A35] flex flex-col">
          <MessageThreadFull />
        </div>
        <div className="w-[60%]">
          <Workbench />
        </div>
      </div>
    </div>
  );
}