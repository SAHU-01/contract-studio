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
}

interface AbiFunction {
  name: string;
  type: string;
  stateMutability: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
}

const KNOWN_FUNCTIONS: AbiFunction[] = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "mint", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "burn", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "pause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "unpause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
];

function truncateAddr(addr: string): string {
  if (addr.length <= 13) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function InteractTab() {
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [selected, setSelected] = useState<DeploymentRecord | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});

  const loadDeployments = useCallback(() => {
    try {
      const stored = localStorage.getItem("contract-studio-deployments");
      if (stored) {
        const parsed = JSON.parse(stored) as DeploymentRecord[];
        setDeployments(parsed);
        if (parsed.length > 0 && !selected) {
          setSelected(parsed[0]);
        }
      }
    } catch {
      // ignore
    }
  }, [selected]);

  useEffect(() => {
    loadDeployments();
    const interval = setInterval(loadDeployments, 3000);
    return () => clearInterval(interval);
  }, [loadDeployments]);

  const readFn = async (fn: AbiFunction) => {
    if (!selected || typeof window === "undefined" || !window.ethereum) return;
    const key = fn.name;
    setLoading((p) => ({ ...p, [key]: true }));
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        selected.contractAddress,
        KNOWN_FUNCTIONS.filter((f) => f.type === "function"),
        provider
      );
      const fnInputs = inputs[key] || {};
      const args = fn.inputs.map((inp) => fnInputs[inp.name] || "");
      const result = await contract[fn.name](...args);
      setResults((p) => ({ ...p, [key]: String(result) }));
    } catch (err: unknown) {
      setResults((p) => ({
        ...p,
        [key]: "Error: " + ((err as { reason?: string }).reason || (err as { message?: string }).message || "Unknown"),
      }));
    }
    setLoading((p) => ({ ...p, [key]: false }));
  };

  const writeFn = async (fn: AbiFunction) => {
    if (!selected || typeof window === "undefined" || !window.ethereum) return;
    const key = fn.name;
    setLoading((p) => ({ ...p, [key]: true }));
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        selected.contractAddress,
        KNOWN_FUNCTIONS.filter((f) => f.type === "function"),
        signer
      );
      const fnInputs = inputs[key] || {};
      const args = fn.inputs.map((inp) => fnInputs[inp.name] || "");
      const tx = await contract[fn.name](...args);
      setResults((p) => ({ ...p, [key]: "Tx sent: " + tx.hash }));
      await tx.wait();
      setResults((p) => ({ ...p, [key]: "Confirmed: " + tx.hash }));
    } catch (err: unknown) {
      const e = err as { code?: string; reason?: string; message?: string };
      if (e.code === "ACTION_REJECTED") {
        setResults((p) => ({ ...p, [key]: "Rejected by user" }));
      } else {
        setResults((p) => ({
          ...p,
          [key]: "Error: " + (e.reason || e.message || "Unknown"),
        }));
      }
    }
    setLoading((p) => ({ ...p, [key]: false }));
  };

  const setInput = (fn: string, param: string, value: string) => {
    setInputs((p) => ({ ...p, [fn]: { ...(p[fn] || {}), [param]: value } }));
  };

  const readFns = KNOWN_FUNCTIONS.filter(
    (f) => f.stateMutability === "view" || f.stateMutability === "pure"
  );
  const writeFns = KNOWN_FUNCTIONS.filter(
    (f) => f.stateMutability === "nonpayable" || f.stateMutability === "payable"
  );

  if (deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6B6B80] space-y-3">
        <div className="text-4xl">📝</div>
        <p className="text-sm">No deployed contracts yet</p>
        <p className="text-xs">Deploy a contract via chat to interact with it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Contract Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[#8B8BA0] uppercase tracking-wider">
          Contract
        </label>
        <select
          className="w-full bg-[#1A1A24] border border-[#2A2A35] rounded-lg px-3 py-2 text-sm text-[#E8E8E8] focus:border-[#00F0FF]/50 focus:outline-none"
          value={selected?.contractAddress || ""}
          onChange={(e) => {
            const d = deployments.find((d) => d.contractAddress === e.target.value);
            if (d) setSelected(d);
          }}
        >
          {deployments.map((d) => (
            <option key={d.contractAddress} value={d.contractAddress}>
              {d.contractName} ({d.symbol}) — {truncateAddr(d.contractAddress)} — {d.chainName}
            </option>
          ))}
        </select>
      </div>

      {/* Read Functions */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-[#00F0FF] uppercase tracking-wider">
          Read Functions
        </h3>
        <div className="grid gap-2">
          {readFns.map((fn) => (
            <div key={fn.name} className="bg-[#1A1A24] border border-[#2A2A35] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-[#E8E8E8]">{fn.name}</span>
                <button
                  className="text-xs px-3 py-1 rounded-md bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20 hover:bg-[#00F0FF]/20 disabled:opacity-50"
                  onClick={() => readFn(fn)}
                  disabled={loading[fn.name]}
                >
                  {loading[fn.name] ? "..." : "Query"}
                </button>
              </div>
              {fn.inputs.map((inp) => (
                <input
                  key={inp.name}
                  type="text"
                  placeholder={`${inp.name} (${inp.type})`}
                  className="w-full bg-[#13131A] border border-[#2A2A35] rounded px-2 py-1 text-xs text-[#E8E8E8] placeholder-[#4A4A5A]"
                  value={inputs[fn.name]?.[inp.name] || ""}
                  onChange={(e) => setInput(fn.name, inp.name, e.target.value)}
                />
              ))}
              {results[fn.name] !== undefined && (
                <div className="text-xs font-mono text-[#10B981] bg-[#10B981]/5 rounded px-2 py-1 break-all">
                  {results[fn.name]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Write Functions */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-[#F59E0B] uppercase tracking-wider">
          Write Functions
        </h3>
        <div className="grid gap-2">
          {writeFns.map((fn) => (
            <div key={fn.name} className="bg-[#1A1A24] border border-[#2A2A35] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-[#E8E8E8]">{fn.name}</span>
                <button
                  className="text-xs px-3 py-1 rounded-md bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 hover:bg-[#F59E0B]/20 disabled:opacity-50"
                  onClick={() => writeFn(fn)}
                  disabled={loading[fn.name]}
                >
                  {loading[fn.name] ? "Pending..." : "Execute"}
                </button>
              </div>
              {fn.inputs.map((inp) => (
                <input
                  key={inp.name}
                  type="text"
                  placeholder={`${inp.name} (${inp.type})`}
                  className="w-full bg-[#13131A] border border-[#2A2A35] rounded px-2 py-1 text-xs text-[#E8E8E8] placeholder-[#4A4A5A]"
                  value={inputs[fn.name]?.[inp.name] || ""}
                  onChange={(e) => setInput(fn.name, inp.name, e.target.value)}
                />
              ))}
              {results[fn.name] !== undefined && (
                <div className={`text-xs font-mono rounded px-2 py-1 break-all ${
                  results[fn.name].startsWith("Error") || results[fn.name].startsWith("Rejected")
                    ? "text-[#EF4444] bg-[#EF4444]/5"
                    : results[fn.name].startsWith("Confirmed")
                    ? "text-[#10B981] bg-[#10B981]/5"
                    : "text-[#F59E0B] bg-[#F59E0B]/5"
                }`}>
                  {results[fn.name]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
