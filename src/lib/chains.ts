export interface ChainConfig {
  chainId: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
  color: string;         // for UI charts
  icon: string;          // chain icon identifier
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    shortName: "Base",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    explorerApiUrl: "https://api-sepolia.basescan.org/api",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: true,
    color: "#0052FF",
    icon: "base",
  },
  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    shortName: "Arb",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorerUrl: "https://sepolia.arbiscan.io",
    explorerApiUrl: "https://api-sepolia.arbiscan.io/api",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: true,
    color: "#28A0F0",
    icon: "arbitrum",
  },
  ethereumSepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    shortName: "ETH",
    rpcUrl: "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io",
    explorerApiUrl: "https://api-sepolia.etherscan.io/api",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: true,
    color: "#627EEA",
    icon: "ethereum",
  },
};

export function getChainById(chainId: number): ChainConfig | undefined {
  return Object.values(SUPPORTED_CHAINS).find((c) => c.chainId === chainId);
}

export function getChainByName(name: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS[name];
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const chain = getChainById(chainId);
  return chain ? `${chain.explorerUrl}/tx/${txHash}` : "#";
}

export function getExplorerAddressUrl(chainId: number, address: string): string {
  const chain = getChainById(chainId);
  return chain ? `${chain.explorerUrl}/address/${address}` : "#";
}