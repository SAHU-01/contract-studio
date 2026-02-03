"use client";

import { useState, useEffect, useCallback } from "react";
import { SUPPORTED_CHAINS } from "@/lib/chains";

interface WalletState {
  connected: boolean;
  address: string;
  chainId: number;
  chainName: string;
  balance: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
}

export function useWallet(): WalletState {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(0);
  const [balance, setBalance] = useState("0.0000");

  const getChainName = (id: number) => {
    const chain = Object.values(SUPPORTED_CHAINS).find(
      (c) => c.chainId === id
    );
    return chain?.name || (id ? "Chain " + id : "Not Connected");
  };

  const updateBalance = useCallback(async (addr: string) => {
    if (!window.ethereum || !addr) return;
    try {
      const balHex = (await window.ethereum.request({
        method: "eth_getBalance",
        params: [addr, "latest"],
      })) as string;
      const bal = Number(BigInt(balHex)) / 1e18;
      setBalance(bal.toFixed(4));
    } catch {
      setBalance("0.0000");
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const chainHex = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      setAddress(accounts[0]);
      setChainId(parseInt(chainHex, 16));
      setConnected(true);
      await updateBalance(accounts[0]);
    } catch (err) {
      console.error("Failed to connect:", err);
    }
  }, [updateBalance]);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress("");
    setChainId(0);
    setBalance("0.0000");
  }, []);

  const switchChain = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + targetChainId.toString(16) }],
      });
    } catch (err) {
      console.error("Failed to switch chain:", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAddress(accounts[0]);
        setConnected(true);
        updateBalance(accounts[0]);
      }
    };

    const handleChainChanged = (chainHex: string) => {
      const newId = parseInt(chainHex, 16);
      setChainId(newId);
      if (address) updateBalance(address);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    // Auto-reconnect if already connected
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: unknown) => {
        const accts = accounts as string[];
        if (accts.length > 0) {
          setAddress(accts[0]);
          setConnected(true);
          window.ethereum!
            .request({ method: "eth_chainId" })
            .then((hex: unknown) => {
              setChainId(parseInt(hex as string, 16));
              updateBalance(accts[0]);
            });
        }
      });

    return () => {
      window.ethereum?.removeListener(
        "accountsChanged",
        handleAccountsChanged
      );
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [address, disconnect, updateBalance]);

  return {
    connected,
    address,
    chainId,
    chainName: getChainName(chainId),
    balance,
    connect,
    disconnect,
    switchChain,
  };
}
