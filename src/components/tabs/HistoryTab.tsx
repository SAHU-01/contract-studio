"use client";
import React, { useState, useEffect, useCallback } from "react";

interface DeploymentRecord {
  contractAddress: string;
  contractName: string;
  symbol: string;
  chainId: number;
  chainName: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  features: string[];
  explorerContractUrl: string;
  explorerTxUrl?: string;
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length <= 13) return addr || "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  return days + "d ago";
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export default function HistoryTab() {
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadDeployments = useCallback(() => {
    try {
      const raw = localStorage.getItem("contract-studio-deployments");
      if (raw) {
        const parsed = JSON.parse(raw);
        setDeployments(parsed.sort((a: DeploymentRecord, b: DeploymentRecord) => b.timestamp - a.timestamp));
      }
    } catch (e) {
      console.error("Failed to load deployments", e);
    }
  }, []);

  useEffect(() => {
    loadDeployments();
    const interval = setInterval(loadDeployments, 3000);
    return () => clearInterval(interval);
  }, [loadDeployments]);

  const clearHistory = () => {
    localStorage.removeItem("contract-studio-deployments");
    setDeployments([]);
  };

  const handleCopy = (text: string, field: string) => {
    copyToClipboard(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#8B8BA0] space-y-3">
        <div className="text-4xl">📋</div>
        <p className="text-sm font-medium">No deployment history</p>
        <p className="text-xs">Your deployments will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[#8B8BA0]">
        <span>{deployments.length} DEPLOYMENT{deployments.length !== 1 ? "S" : ""}</span>
        <button onClick={clearHistory} className="text-red-400 hover:text-red-300">Clear</button>
      </div>
      {deployments.map((d, i) => (
        <div key={i} className="p-4 rounded-lg bg-[#1A1A24] border border-[#2A2A35] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#E8E8E8]">{d.contractName}</span>
              <span className="text-xs text-[#8B8BA0]">({d.symbol})</span>
            </div>
            <span className="text-xs text-[#8B8BA0]">{timeAgo(d.timestamp)}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <span className="text-[#8B8BA0]">Chain: </span>
              <span className="text-[#E8E8E8]">{d.chainName}</span>
            </div>
            <div>
              <span className="text-[#8B8BA0]">Block: </span>
              <span className="text-[#E8E8E8]">#{d.blockNumber}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#8B8BA0]">Contract: </span>
              <a href={d.explorerContractUrl} target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline font-mono">{truncateAddr(d.contractAddress)}</a>
              <button onClick={() => handleCopy(d.contractAddress, `contract-${i}`)} className="ml-1 text-[#8B8BA0] hover:text-[#00F0FF]" title="Copy">
                {copiedField === `contract-${i}` ? "✓" : "⧉"}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#8B8BA0]">Tx: </span>
              <a href={d.explorerTxUrl} target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline font-mono">{truncateAddr(d.txHash)}</a>
              <button onClick={() => handleCopy(d.txHash, `tx-${i}`)} className="ml-1 text-[#8B8BA0] hover:text-[#00F0FF]" title="Copy">
                {copiedField === `tx-${i}` ? "✓" : "⧉"}
              </button>
            </div>
          </div>
          {d.features && d.features.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {d.features.map((f) => (
                <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20">{f}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
