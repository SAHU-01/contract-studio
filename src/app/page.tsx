"use client";

import { useWallet } from "@/hooks/useWallet";
import WalletStatus from "@/components/WalletStatus";
import Workbench from "@/components/WorkBench";
// Import the Tambo chat component from the scaffold
// It's usually MessageThreadFull or MessageThreadCollapsible
import { MessageThreadFull } from "@/components/tambo/message-thread-full";

export default function Home() {
  const wallet = useWallet();

  return (
    <div className="flex flex-col h-screen bg-[#0D0D0F]">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#2A2A35]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[#E8E8E8]">
            Contract Studio
          </h1>
          <span className="text-xs px-2 py-0.5 rounded bg-[#1A1A20] text-[#00F0FF] border border-[#00F0FF]/20">
            Testnet
          </span>
        </div>
        <WalletStatus
          connected={wallet.connected}
          address={wallet.address}
          chainName={wallet.chainName}
          balance={wallet.balance}
          onConnect={wallet.connect}
        />
      </header>

      {/* Main Content — Split Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat Panel (40%) */}
        <div className="w-[40%] border-r border-[#2A2A35] flex flex-col">
          <MessageThreadFull />
        </div>

        {/* Right: Workbench (60%) */}
        <div className="w-[60%]">
          <Workbench />
        </div>
      </div>
    </div>
  );
}