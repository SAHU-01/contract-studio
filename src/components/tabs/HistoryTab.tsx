"use client";
import React, { useState, useEffect, useCallback } from "react";
import { SUPPORTED_CHAINS, getChainById, type ChainConfig } from "@/lib/chains";
import { ethers } from "ethers";

// ============================================================
// TYPES
// ============================================================
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

const STORAGE_KEY = "contract-studio-deployments";
const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || "";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

// ============================================================
// HELPERS
// ============================================================
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

// ============================================================
// DECODE NAME/SYMBOL FROM CONSTRUCTOR ARGS IN TX INPUT
// ============================================================
function decodeConstructorArgs(input: string): { name: string; symbol: string } | null {
  try {
    const hex = input.startsWith("0x") ? input.slice(2) : input;
    
    // Constructor args are appended after bytecode
    // Search for the ABI-encoded pattern: offset 0x60, offset 0xa0
    const marker = "0000000000000000000000000000000000000000000000000000000000000060" +
                   "00000000000000000000000000000000000000000000000000000000000000a0";

    const idx = hex.lastIndexOf(marker);
    if (idx === -1) return null;

    const argsHex = "0x" + hex.slice(idx);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ["string", "string", "uint256"],
      argsHex
    );
    
    const name = decoded[0] as string;
    const symbol = decoded[1] as string;
    if (name && symbol && name.length < 100 && symbol.length < 20) {
      return { name, symbol };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// ETHERSCAN FETCH
// ============================================================
async function fetchDeploymentsFromChain(
  chain: ChainConfig,
  walletAddress: string
): Promise<DeploymentRecord[]> {
  const records: DeploymentRecord[] = [];

  try {
    const apiUrl = `https://api.etherscan.io/v2/api?chainid=${chain.chainId}&module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;

    const resp = await fetch(apiUrl);
    const data = await resp.json();

    if (data.status !== "1" || !Array.isArray(data.result)) {
      console.warn(`Etherscan: no results for ${chain.name}:`, data.message || data.result);
      return records;
    }

    const deployTxs = data.result.filter(
      (tx: any) =>
        tx.from?.toLowerCase() === walletAddress.toLowerCase() &&
        (!tx.to || tx.to === "") &&
        tx.contractAddress &&
        tx.contractAddress !== "" &&
        tx.isError === "0"
    );

    for (const tx of deployTxs) {
      let contractName = "Unknown Contract";
      let symbol = "???";

      const decoded = decodeConstructorArgs(tx.input);
      if (decoded) {
        contractName = decoded.name;
        symbol = decoded.symbol;
      }else{
        try {
          const tokenUrl = `https://api.etherscan.io/v2/api?chainid=${chain.chainId}&module=token&action=tokeninfo&contractaddress=${tx.contractAddress}&apikey=${ETHERSCAN_API_KEY}`;
          const tokenResp = await fetch(tokenUrl);
          const tokenData = await tokenResp.json();
          if (tokenData.status === "1" && tokenData.result?.[0]) {
            contractName = tokenData.result[0].tokenName || contractName;
            symbol = tokenData.result[0].symbol || symbol;
          }
        } catch { /* ignore */ }
      }

      records.push({
        contractAddress: tx.contractAddress,
        contractName,
        symbol,
        chainId: chain.chainId,
        chainName: chain.name,
        txHash: tx.hash,
        blockNumber: parseInt(tx.blockNumber, 10),
        timestamp: parseInt(tx.timeStamp, 10) * 1000,
        features: [],
        explorerContractUrl: `${chain.explorerUrl}/address/${tx.contractAddress}`,
        explorerTxUrl: `${chain.explorerUrl}/tx/${tx.hash}`,
      });
    }
  } catch (e) {
    console.error(`Failed to fetch from ${chain.name}:`, e);
  }

  return records;
}

async function fetchAllChainsDeployments(walletAddress: string): Promise<DeploymentRecord[]> {
  const chains = Object.values(SUPPORTED_CHAINS);
  const results = await Promise.allSettled(
    chains.map((chain) => fetchDeploymentsFromChain(chain, walletAddress))
  );

  const allRecords: DeploymentRecord[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allRecords.push(...result.value);
    }
  }

  allRecords.sort((a, b) => b.timestamp - a.timestamp);
  return allRecords;
}

/** Background: hydrate unknown contracts via RPC */
async function hydrateUnknownContracts(records: DeploymentRecord[]): Promise<DeploymentRecord[]> {
  const updated = [...records];
  const unknowns = updated.filter((r) => r.contractName === "Unknown Contract");
  if (unknowns.length === 0) return updated;

  const byChain = new Map<number, DeploymentRecord[]>();
  for (const r of unknowns) {
    const arr = byChain.get(r.chainId) || [];
    arr.push(r);
    byChain.set(r.chainId, arr);
  }

  for (const [chainId, recs] of byChain) {
    const chain = getChainById(chainId);
    if (!chain) continue;
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    for (const rec of recs) {
      try {
        const contract = new ethers.Contract(rec.contractAddress, ERC20_ABI, provider);
        const [name, sym] = await Promise.allSettled([
          contract.name(),
          contract.symbol(),
        ]);
        if (name.status === "fulfilled" && name.value) rec.contractName = name.value;
        if (sym.status === "fulfilled" && sym.value) rec.symbol = sym.value;
      } catch { /* leave as Unknown */ }
    }
  }

  return updated;
}

// ============================================================
// COMPONENT
// ============================================================
export default function HistoryTab() {
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedFromChain, setFetchedFromChain] = useState(false);

  const getWalletAddress = useCallback(async (): Promise<string | null> => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      return accounts?.[0] || null;
    } catch {
      return null;
    }
  }, []);

  const loadFromStorage = useCallback((): DeploymentRecord[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.sort(
            (a: DeploymentRecord, b: DeploymentRecord) => b.timestamp - a.timestamp
          );
        }
      }
    } catch (e) {
      console.error("Failed to load from localStorage:", e);
    }
    return [];
  }, []);

  const saveToStorage = useCallback((records: DeploymentRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  }, []);

  const loadDeployments = useCallback(async () => {
    const stored = loadFromStorage();
    if (stored.length > 0) {
      setDeployments(stored);
      return;
    }

    if (fetchedFromChain) return;

    const wallet = await getWalletAddress();
    if (!wallet) return;

    setLoading(true);
    setFetchedFromChain(true);

    try {
      const chainRecords = await fetchAllChainsDeployments(wallet);
      if (chainRecords.length > 0) {
        setDeployments(chainRecords);
        saveToStorage(chainRecords);
        setLoading(false);

        // Background hydrate unknowns
        hydrateUnknownContracts(chainRecords).then((hydrated) => {
          setDeployments(hydrated);
          saveToStorage(hydrated);
        });
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error("Failed to fetch from chain:", e);
      setLoading(false);
    }
  }, [loadFromStorage, getWalletAddress, saveToStorage, fetchedFromChain]);

  useEffect(() => {
    loadDeployments();
    const interval = setInterval(() => {
      const stored = loadFromStorage();
      if (stored.length > 0) {
        setDeployments(stored);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loadDeployments, loadFromStorage]);

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDeployments([]);
    setFetchedFromChain(false);
  };

  const refreshFromChain = async () => {
    const wallet = await getWalletAddress();
    if (!wallet) return;

    setLoading(true);
    try {
      const chainRecords = await fetchAllChainsDeployments(wallet);
      if (chainRecords.length > 0) {
        const existing = loadFromStorage();
        const existingAddrs = new Set(existing.map((d) => d.contractAddress.toLowerCase()));
        const newRecords = chainRecords.filter(
          (r) => !existingAddrs.has(r.contractAddress.toLowerCase())
        );
        const merged = [...existing, ...newRecords].sort((a, b) => b.timestamp - a.timestamp);
        setDeployments(merged);
        saveToStorage(merged);
        setLoading(false);

        hydrateUnknownContracts(merged).then((hydrated) => {
          setDeployments(hydrated);
          saveToStorage(hydrated);
        });
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error("Refresh failed:", e);
      setLoading(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    copyToClipboard(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <div className="w-6 h-6 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#8B8BA0]">Fetching deployments from chain...</p>
        <p className="text-xs text-[#5E5E6E]">Scanning all supported networks</p>
      </div>
    );
  }

  if (deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#8B8BA0] space-y-3">
        <div className="text-4xl">📋</div>
        <p className="text-sm font-medium">No deployment history</p>
        <p className="text-xs">Your deployments will appear here</p>
        <button
          onClick={refreshFromChain}
          className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-[#1A1A20] border border-[#2A2A35] text-[#00F0FF] hover:border-[#00F0FF] transition-colors"
        >
          🔄 Scan chain for deployments
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[#8B8BA0]">
        <span>{deployments.length} DEPLOYMENT{deployments.length !== 1 ? "S" : ""}</span>
        <div className="flex items-center gap-3">
          <button onClick={refreshFromChain} className="text-[#00F0FF] hover:text-[#33F5FF] transition-colors" title="Refresh from chain">
            🔄 Sync
          </button>
          <button onClick={clearHistory} className="text-red-400 hover:text-red-300 transition-colors">
            Clear
          </button>
        </div>
      </div>

      {deployments.map((d, i) => (
        <div key={`${d.contractAddress}-${i}`} className="p-4 rounded-lg bg-[#1A1A24] border border-[#2A2A35] space-y-3 hover:border-[#3A3A45] transition-colors">
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
              <a href={d.explorerContractUrl} target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline font-mono">
                {truncateAddr(d.contractAddress)}
              </a>
              <button onClick={() => handleCopy(d.contractAddress, `contract-${i}`)} className="ml-1 text-[#8B8BA0] hover:text-[#00F0FF] transition-colors" title="Copy address">
                {copiedField === `contract-${i}` ? "✓" : "⧉"}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#8B8BA0]">Tx: </span>
              <a href={d.explorerTxUrl} target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline font-mono">
                {truncateAddr(d.txHash)}
              </a>
              <button onClick={() => handleCopy(d.txHash, `tx-${i}`)} className="ml-1 text-[#8B8BA0] hover:text-[#00F0FF] transition-colors" title="Copy tx hash">
                {copiedField === `tx-${i}` ? "✓" : "⧉"}
              </button>
            </div>
          </div>

          {d.features && d.features.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {d.features.map((f) => (
                <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}