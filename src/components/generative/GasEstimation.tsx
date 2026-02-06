"use client";
import React from "react";

interface ChainEstimate {
  chain?: string;
  gasEstimate?: number;
  gasPriceGwei?: number;
  estimatedCostEth?: string;
  estimatedCostUsd?: string;
}

interface GasEstimationProps {
  contractName?: string;
  chains?: ChainEstimate[];
  recommendedChain?: string;
}

export default function GasEstimation(props: GasEstimationProps) {
  const chains = (props.chains ?? []).filter(c => c.chain);
  
  if (chains.length === 0) {
    return (
      <div className="p-5 rounded-xl bg-[#13131A] border border-[#2A2A35] text-center text-[#6B6B80] text-sm">
        No gas estimation data available
      </div>
    );
  }

  const maxGas = Math.max(...chains.map((c) => c.gasEstimate ?? 0));

  return (
    <div className="p-5 rounded-xl bg-[#13131A] border border-[#2A2A35] space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#E8E8E8]">
          Gas Estimation
          {props.contractName ? ` — ${props.contractName}` : ""}
        </h2>
        {props.recommendedChain && (
          <span className="text-xs px-2.5 py-1 rounded-full font-medium text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20">
            Best: {props.recommendedChain}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {chains.map((chain, i) => {
          const gasEst = chain.gasEstimate ?? 0;
          const gasPrice = chain.gasPriceGwei ?? 0;
          const pct = maxGas > 0 ? (gasEst / maxGas) * 100 : 0;
          const isRecommended = chain.chain === props.recommendedChain;
          const barColor = isRecommended ? "#10B981" : "#00F0FF";

          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${isRecommended ? "text-[#10B981]" : "text-[#E8E8E8]"}`}>
                  {chain.chain || "Unknown"}
                  {isRecommended ? " ⭐" : ""}
                </span>
                <span className="text-[#8B8BA0]">
                  {chain.estimatedCostEth || "—"} ETH
                  {chain.estimatedCostUsd ? ` (~$${chain.estimatedCostUsd})` : ""}
                </span>
              </div>
              <div className="h-6 bg-[#1A1A24] rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: pct + "%",
                    backgroundColor: barColor + "30",
                    borderRight: "2px solid " + barColor,
                  }}
                />
                <div className="absolute inset-0 flex items-center px-2">
                  <span className="text-[10px] font-mono text-[#6B6B80]">
                    {gasEst > 0 ? gasEst.toLocaleString() : "—"} gas @ {gasPrice.toFixed(2)} gwei
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
