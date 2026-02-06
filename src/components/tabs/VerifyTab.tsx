"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  submitVerification,
  pollVerificationStatus,
  getERC20FlattenedSource,
  checkIsVerified,
} from "@/lib/verification";

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

type VerifyStatus = "idle" | "submitting" | "pending" | "verified" | "failed";

interface VerifyState {
  status: VerifyStatus;
  message: string;
  guid?: string;
}

const STORAGE_KEY = "contract-studio-deployments";
const VERIFY_STORAGE_KEY = "contract-studio-verifications";

function truncateAddr(addr: string): string {
  if (!addr || addr.length <= 13) return addr || "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function loadVerifyStates(): Record<string, VerifyState> {
  try {
    const raw = localStorage.getItem(VERIFY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveVerifyStates(states: Record<string, VerifyState>) {
  try {
    localStorage.setItem(VERIFY_STORAGE_KEY, JSON.stringify(states));
  } catch {}
}

export default function VerifyTab() {
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [verifyStates, setVerifyStates] = useState<Record<string, VerifyState>>(
    {}
  );
  const pollingRef = useRef(false);

  const deploymentsLoadedRef = useRef(false);
  const verifyCheckDoneRef = useRef(false);

  // Load deployments from localStorage (once + interval for new deploys)
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setDeployments(
              parsed.sort(
                (a: DeploymentRecord, b: DeploymentRecord) =>
                  b.timestamp - a.timestamp
              )
            );
            if (!deploymentsLoadedRef.current && parsed.length > 0) {
              deploymentsLoadedRef.current = true;
            }
          }
        }
      } catch {}
    };
    load();
    setVerifyStates(loadVerifyStates());
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  // On mount: check Etherscan for already-verified contracts (runs once)
  useEffect(() => {
    if (deployments.length === 0 || verifyCheckDoneRef.current) return;
    verifyCheckDoneRef.current = true;

    const savedStates = loadVerifyStates();
    const toCheck = deployments.filter((d) => {
      const addr = d.contractAddress.toLowerCase();
      const state = savedStates[addr];
      return !state || state.status === "idle" || state.status === "failed";
    });

    if (toCheck.length === 0) return;

    let cancelled = false;

    const checkAll = async () => {
      for (const d of toCheck) {
        if (cancelled) break;
        const addr = d.contractAddress.toLowerCase();

        try {
          const isVerified = await checkIsVerified(d.contractAddress, d.chainId);
          if (isVerified && !cancelled) {
            // Update immediately per-contract so UI refreshes progressively
            setVerifyStates((prev) => {
              const next = {
                ...prev,
                [addr]: {
                  status: "verified" as VerifyStatus,
                  message: "Verified on Etherscan ✓",
                },
              };
              saveVerifyStates(next);
              return next;
            });
          }
        } catch {
          // Ignore — leave as unverified
        }

        // Rate limit: 1.5s between Etherscan API calls
        if (!cancelled) await new Promise((r) => setTimeout(r, 1500));
      }
    };

    checkAll();
    return () => { cancelled = true; };
  }, [deployments]);

  // Poll pending verifications — 15s interval to avoid Etherscan rate limits
  useEffect(() => {
    const pendingEntries = Object.entries(verifyStates).filter(
      ([, v]) => v.status === "pending" && v.guid
    );

    if (pendingEntries.length === 0) return;

    const poll = async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;

      let changed = false;
      const updated = { ...verifyStates };

      for (const [addr, state] of pendingEntries) {
        if (!state.guid) continue;
        const deployment = deployments.find(
          (d) => d.contractAddress.toLowerCase() === addr.toLowerCase()
        );
        if (!deployment) continue;

        try {
          const result = await pollVerificationStatus(
            state.guid,
            deployment.chainId
          );

          if (result.status !== "pending") {
            updated[addr] = {
              status: result.status,
              message: result.message,
              guid: state.guid,
            };
            changed = true;
          }
        } catch {
          // Network error — keep pending, don't mark failed
        }

        // 2s delay between checks to respect rate limits
        await new Promise((r) => setTimeout(r, 2000));
      }

      pollingRef.current = false;

      if (changed) {
        setVerifyStates(updated);
        saveVerifyStates(updated);
      }
    };

    // Initial poll after 3s, then every 15s
    const timeout = setTimeout(poll, 3000);
    const interval = setInterval(poll, 15000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [verifyStates, deployments]);

  const handleVerify = useCallback(
    async (deployment: DeploymentRecord) => {
      const addr = deployment.contractAddress.toLowerCase();

      const newStates = {
        ...verifyStates,
        [addr]: {
          status: "submitting" as VerifyStatus,
          message: "Submitting to Etherscan...",
        },
      };
      setVerifyStates(newStates);
      saveVerifyStates(newStates);

      try {
        const sourceCode = getERC20FlattenedSource();

        // Get constructor args from tx input
        let constructorArguments = "";
        try {
          const txUrl = `https://api.etherscan.io/v2/api?chainid=${deployment.chainId}&module=proxy&action=eth_getTransactionByHash&txhash=${deployment.txHash}&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || ""}`;
          const txResp = await fetch(txUrl);
          const txData = await txResp.json();
          if (txData.result?.input) {
            const input = txData.result.input;
            const marker =
              "0000000000000000000000000000000000000000000000000000000000000060" +
              "00000000000000000000000000000000000000000000000000000000000000a0";
            const hex = input.startsWith("0x") ? input.slice(2) : input;
            const idx = hex.lastIndexOf(marker);
            if (idx !== -1) {
              constructorArguments = hex.slice(idx);
            }
          }
        } catch (e) {
          console.warn("Could not extract constructor args:", e);
        }

        const result = await submitVerification({
          contractAddress: deployment.contractAddress,
          chainId: deployment.chainId,
          sourceCode,
          contractName: "DeployableToken",
          constructorArguments,
          optimizationUsed: false,
          runs: 200,
        });

        if (result.success && result.guid) {
          // If already verified, skip polling — mark verified immediately
          if (result.guid === "__already_verified__") {
            const verifiedState = {
              ...verifyStates,
              [addr]: {
                status: "verified" as VerifyStatus,
                message: "Already Verified ✓",
              },
            };
            setVerifyStates(verifiedState);
            saveVerifyStates(verifiedState);
          } else {
            const pendingState = {
              ...verifyStates,
              [addr]: {
                status: "pending" as VerifyStatus,
                message: "Submitted! Waiting for Etherscan...",
                guid: result.guid,
              },
            };
            setVerifyStates(pendingState);
            saveVerifyStates(pendingState);
          }
        } else {
          // Etherscan returns various "already verified" messages as errors
          if (
            result.error &&
            typeof result.error === "string" &&
            result.error.toLowerCase().includes("already verified")
          ) {
            const verifiedState = {
              ...verifyStates,
              [addr]: {
                status: "verified" as VerifyStatus,
                message: "Already Verified ✓",
              },
            };
            setVerifyStates(verifiedState);
            saveVerifyStates(verifiedState);
          } else {
            const failedState = {
              ...verifyStates,
              [addr]: {
                status: "failed" as VerifyStatus,
                message: result.error || "Submission failed",
              },
            };
            setVerifyStates(failedState);
            saveVerifyStates(failedState);
          }
        }
      } catch (e: any) {
        const errorState = {
          ...verifyStates,
          [addr]: {
            status: "failed" as VerifyStatus,
            message: e.message || "Unexpected error",
          },
        };
        setVerifyStates(errorState);
        saveVerifyStates(errorState);
      }
    },
    [verifyStates]
  );

  if (deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#8B8BA0] space-y-3">
        <div className="text-4xl">🔍</div>
        <p className="text-sm font-medium">No contracts to verify</p>
        <p className="text-xs">Deploy a contract first, then verify it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-[#8B8BA0] mb-2">
        {deployments.length} CONTRACT{deployments.length !== 1 ? "S" : ""}{" "}
        AVAILABLE
      </div>

      <div className="p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A35] text-xs text-[#8B8BA0] mb-3">
        <span className="text-[#00F0FF]">ℹ</span> Verification submits your
        contract source code to Etherscan so anyone can read and audit it. Uses
        Etherscan V2 API with your API key.
      </div>

      {deployments.map((d) => {
        const addr = d.contractAddress.toLowerCase();
        const state = verifyStates[addr] || {
          status: "idle",
          message: "",
        };

        const statusColor =
          state.status === "verified"
            ? "#10B981"
            : state.status === "failed"
            ? "#EF4444"
            : state.status === "pending" || state.status === "submitting"
            ? "#F59E0B"
            : "#8B8BA0";

        const statusIcon =
          state.status === "verified"
            ? "✅"
            : state.status === "failed"
            ? "❌"
            : state.status === "pending" || state.status === "submitting"
            ? "⏳"
            : "🔒";

        return (
          <div
            key={d.contractAddress}
            className="p-4 rounded-lg bg-[#1A1A24] border border-[#2A2A35] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#E8E8E8]">
                  {d.contractName}
                </span>
                <span className="text-xs text-[#8B8BA0]">({d.symbol})</span>
              </div>
              <span className="text-xs" style={{ color: statusColor }}>
                {statusIcon}{" "}
                {state.status === "idle"
                  ? "Unverified"
                  : state.status === "submitting"
                  ? "Submitting..."
                  : state.status === "pending"
                  ? "Pending..."
                  : state.status === "verified"
                  ? "Verified"
                  : "Failed"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <span className="text-[#8B8BA0]">Chain: </span>
                <span className="text-[#E8E8E8]">{d.chainName}</span>
              </div>
              <div>
                <span className="text-[#8B8BA0]">Address: </span>
                <a
                  href={d.explorerContractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00F0FF] hover:underline font-mono"
                >
                  {truncateAddr(d.contractAddress)}
                </a>
              </div>
            </div>

            {state.message && (
              <div
                className="text-xs px-2 py-1 rounded"
                style={{
                  color: statusColor,
                  backgroundColor: statusColor + "15",
                  borderLeft: `2px solid ${statusColor}`,
                }}
              >
                {state.message}
              </div>
            )}

            <div className="flex gap-2">
              {state.status === "idle" || state.status === "failed" ? (
                <button
                  onClick={() => handleVerify(d)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20 hover:bg-[#00F0FF]/20 transition-colors"
                >
                  {state.status === "failed"
                    ? "Retry Verification"
                    : "Verify on Etherscan"}
                </button>
              ) : state.status === "verified" ? (
                <a
                  href={`${d.explorerContractUrl}#code`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 hover:bg-[#10B981]/20 transition-colors"
                >
                  View Source on Etherscan →
                </a>
              ) : (
                <span className="text-xs text-[#F59E0B] animate-pulse">
                  Processing...
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}