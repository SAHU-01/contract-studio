"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getChainById } from "@/lib/chains";

export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  chainName: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    balance: null,
    chainName: null,
  });

  const updateBalance = useCallback(async (address: string) => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(address);
      setState((prev) => ({
        ...prev,
        balance: ethers.formatEther(balance),
      }));
    } catch (e) {
      console.error("Failed to get balance:", e);
    }
  }, []);

  const updateChain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      const chainId = parseInt(chainIdHex as string, 16);
      const chain = getChainById(chainId);
      setState((prev) => ({
        ...prev,
        chainId,
        chainName: chain?.name || `Chain ${chainId}`,
      }));
    } catch (e) {
      console.error("Failed to get chain:", e);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("No wallet detected. Install MetaMask.");
    }
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    const address = accounts[0];
    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex as string, 16);
    const chain = getChainById(chainId);
    
    setState({
      connected: true,
      address,
      chainId,
      balance: null,
      chainName: chain?.name || `Chain ${chainId}`,
    });

    await updateBalance(address);
    return { address, chainId };
  }, [updateBalance]);

  const disconnect = useCallback(() => {
    setState({
      connected: false,
      address: null,
      chainId: null,
      balance: null,
      chainName: null,
    });
  }, []);

  const switchChain = useCallback(async (chainId: number) => {
    if (!window.ethereum) throw new Error("No wallet");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        const chain = getChainById(chainId);
        if (!chain) throw new Error(`Unknown chain ${chainId}`);
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: `0x${chainId.toString(16)}`,
            chainName: chain.name,
            rpcUrls: [chain.rpcUrl],
            nativeCurrency: chain.nativeCurrency,
            blockExplorerUrls: [chain.explorerUrl],
          }],
        });
      } else {
        throw error;
      }
    }
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState((prev) => ({ ...prev, address: accounts[0] }));
        updateBalance(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      updateChain();
      if (state.address) updateBalance(state.address);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [state.address, disconnect, updateBalance, updateChain]);

  // Check if already connected on mount
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: any) => {
        if ((accounts as string[]).length > 0) {
          connect();
        }
      })
      .catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    connect,
    disconnect,
    switchChain,
    refreshBalance: () => state.address && updateBalance(state.address),
  };
}