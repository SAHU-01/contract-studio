const DEPLOYMENTS_KEY = "contract-studio-deployments";
const VERIFICATIONS_KEY = "contract-studio-verifications";

export const contextHelpers = {
  walletState: async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      return { connected: false };
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as string[];
      if (!accounts || accounts.length === 0) {
        return { connected: false };
      }
      const chainHex = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      const chainId = parseInt(chainHex, 16);
      const balHex = (await window.ethereum.request({
        method: "eth_getBalance",
        params: [accounts[0], "latest"],
      })) as string;
      const balEth = (Number(BigInt(balHex)) / 1e18).toFixed(4);
      return {
        connected: true,
        address: accounts[0],
        chainId,
        balance: balEth + " ETH",
      };
    } catch {
      return { connected: false };
    }
  },

  deployedContracts: async () => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(DEPLOYMENTS_KEY);
      if (!raw) return [];
      const deployments = JSON.parse(raw);
      return deployments.map((d: any) => ({
        name: d.contractName,
        symbol: d.symbol,
        address: d.contractAddress,
        chain: d.chainName,
        chainId: d.chainId,
      }));
    } catch {
      return [];
    }
  },

  verificationStatus: async () => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(VERIFICATIONS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  activeView: async () => {
    if (typeof window === "undefined") return "deploy";
    // Read from URL hash or default
    return window.location.hash?.replace("#", "") || "deploy";
  },
};