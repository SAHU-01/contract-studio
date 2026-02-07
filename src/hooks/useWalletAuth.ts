"use client";
import { useState, useEffect, useCallback } from "react";

interface WalletUser {
  id: string;
  wallet_address: string;
  created_at: string;
}

interface WalletAuth {
  user: WalletUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  syncDeployment: (deployment: any) => Promise<void>;
}

const AUTH_TOKEN_KEY = "contract-studio-auth-token";
const AUTH_USER_KEY = "contract-studio-auth-user";

export function useWalletAuth(): WalletAuth {
  const [user, setUser] = useState<WalletUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const savedUser = localStorage.getItem(AUTH_USER_KEY);
      if (savedToken && savedUser) {
        // Check if token is expired
        const payload = JSON.parse(atob(savedToken));
        if (payload.exp > Date.now()) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } else {
          // Expired, clear
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
        }
      }
    } catch {}
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }

    setIsLoading(true);
    try {
      // Request account access
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts[0];

      // Create a message to sign
      const message = `Sign in to Contract Studio\n\nWallet: ${address}\nTimestamp: ${new Date().toISOString()}`;

      // Request signature from MetaMask
      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      // Verify signature and create session on server
      const resp = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      // Save session
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }, []);

  const syncDeployment = useCallback(
    async (deployment: any) => {
      if (!token) return;
      try {
        await fetch("/api/deployments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(deployment),
        });
      } catch (e) {
        console.error("Failed to sync deployment:", e);
      }
    },
    [token]
  );

  return {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    signIn,
    signOut,
    syncDeployment,
  };
}