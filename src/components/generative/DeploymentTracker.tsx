"use client";

import React from "react";

interface DeploymentTrackerProps {
  status?: "estimating" | "awaiting-signature" | "confirming" | "confirmed" | "failed";
  contractName?: string;
  symbol?: string;
  chain?: string;
  txHash?: string;
  contractAddress?: string;
  blockNumber?: number;
  gasUsed?: string;
  estimatedCost?: string;
  explorerTxUrl?: string;
  explorerContractUrl?: string;
  errorMessage?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; pulse: boolean }> = {
  estimating: { label: "Estimating Gas", color: "#F59E0B", pulse: true },
  "awaiting-signature": { label: "Awaiting Signature", color: "#F59E0B", pulse: true },
  confirming: { label: "Confirming", color: "#3B82F6", pulse: true },
  confirmed: { label: "Deployed", color: "#10B981", pulse: false },
  failed: { label: "Failed", color: "#EF4444", pulse: false },
};

function truncate(str: string): string {
  if (str.length <= 13) return str;
  return str.slice(0, 6) + "..." + str.slice(-4);
}

function makeLink(url: string, text: string): React.ReactElement {
  return React.createElement("a", {
    href: url,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "text-[#00F0FF] hover:underline font-mono",
  }, text);
}

function makeMono(text: string): React.ReactElement {
  return React.createElement("span", {
    className: "text-[#E8E8E8] font-mono",
  }, text);
}

export default function DeploymentTracker(props: DeploymentTrackerProps) {
  const status = props.status || "estimating";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.estimating;
  const txDisplay = props.txHash ? truncate(props.txHash) : "";
  const addrDisplay = props.contractAddress ? truncate(props.contractAddress) : "";

  return (
    <div className="p-5 rounded-xl bg-[#13131A] border border-[#2A2A35] space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#E8E8E8]">
          {"Deployment"}
          {props.contractName ? ` — ${props.contractName}` : ""}
          {props.symbol ? ` (${props.symbol})` : ""}
        </h2>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium border ${config.pulse ? "animate-pulse" : ""}`}
          style={{
            color: config.color,
            backgroundColor: config.color + "15",
            borderColor: config.color + "30",
          }}
        >
          {config.label}
        </span>
      </div>

      {props.chain && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#9B9BB0]">Chain:</span>
          <span className="text-[#E8E8E8]">{props.chain}</span>
        </div>
      )}

      {props.estimatedCost && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#9B9BB0]">Estimated Cost:</span>
          <span className="text-[#E8E8E8]">{props.estimatedCost}</span>
        </div>
      )}

      {props.gasUsed && props.gasUsed !== "0" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#9B9BB0]">Gas Used:</span>
          <span className="text-[#E8E8E8]">{Number(props.gasUsed).toLocaleString("en-US")}</span>
        </div>
      )}

      {props.txHash && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#9B9BB0]">Tx Hash:</span>
          {props.explorerTxUrl ? makeLink(props.explorerTxUrl, txDisplay) : makeMono(txDisplay)}
        </div>
      )}

      {props.contractAddress && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#9B9BB0]">Contract:</span>
          {props.explorerContractUrl ? makeLink(props.explorerContractUrl, addrDisplay) : makeMono(addrDisplay)}
        </div>
      )}

      {props.blockNumber && props.blockNumber > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#9B9BB0]">Block:</span>
          <span className="text-[#E8E8E8]">#{props.blockNumber}</span>
        </div>
      )}

      {props.errorMessage && (
        <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          {props.errorMessage}
        </div>
      )}

      {status === "confirmed" && props.contractAddress && (
        <div className="p-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 text-sm text-[#10B981]">
          {"✓ Contract deployed successfully"}
          {props.explorerContractUrl && (
            <span>{" — "}{makeLink(props.explorerContractUrl, "View on Explorer")}</span>
          )}
        </div>
      )}
    </div>
  );
}
