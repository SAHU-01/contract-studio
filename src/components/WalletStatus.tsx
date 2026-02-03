"use client";

import { Wallet, ChevronDown, Circle } from "lucide-react";

interface WalletStatusProps {
  connected: boolean;
  address: string | null;
  chainName: string | null;
  balance: string | null;
  onConnect: () => void;
}

export default function WalletStatus({
  connected,
  address,
  chainName,
  balance,
  onConnect,
}: WalletStatusProps) {
  if (!connected) {
    return (
      <button
        onClick={onConnect}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1A20] border border-[#2A2A35] hover:border-[#00F0FF] transition-colors text-sm"
      >
        <Wallet size={16} />
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1A20] border border-[#2A2A35] text-sm">
        <Circle size={8} className="fill-[#00FF88] text-[#00FF88]" />
        <span className="text-[#8E8E9A]">{chainName}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1A20] border border-[#2A2A35] text-sm">
        <span className="text-[#8E8E9A]">
          {balance ? `${parseFloat(balance).toFixed(4)} ETH` : "..."}
        </span>
        <span className="text-[#E8E8E8] font-mono">
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
        </span>
      </div>
    </div>
  );
}