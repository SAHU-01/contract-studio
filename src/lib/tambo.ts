"use client";

import { TamboComponent, TamboTool, withInteractable } from "@tambo-ai/react";
import { z } from "zod";
import StatusCard from "@/components/generative/StatusCard";
import ContractParamsForm, {
  contractParamsSchema,
} from "@/components/interactable/ContractParamsForm";
import { getGlobalPopulationTrend } from "@/services/population-stats";
import { SUPPORTED_CHAINS } from "@/lib/chains";

const InteractableContractForm = withInteractable(ContractParamsForm, {
  componentName: "ContractParamsForm",
  description:
    "An editable smart contract configuration form. Use this when the user wants to configure or deploy a contract. Supports ERC20, ERC721, ERC1155, Custom. Set name, symbol, features (mintable, burnable, pausable, upgradeable, ownable, access-control), initialSupply, and target chain (baseSepolia, arbitrumSepolia, ethereumSepolia).",
  propsSchema: contractParamsSchema,
});

export const components: TamboComponent[] = [
  {
    name: "StatusCard",
    description:
      "A status card with a title, message, and colored status indicator. Use for informational, success, warning, or error messages.",
    component: StatusCard,
    propsSchema: z.object({
      title: z.string().optional().describe("The card title"),
      message: z.string().optional().describe("The card message body"),
      status: z
        .enum(["info", "success", "warning", "error"])
        .optional()
        .describe("Visual status: info=blue, success=green, warning=amber, error=red"),
    }),
  },
];

export const tools: TamboTool[] = [
  {
    name: "connectWallet",
    description:
      "Connect to the user's browser wallet (MetaMask). Call this when the user wants to connect their wallet or before any deployment.",
    tool: async () => {
      if (typeof window === "undefined" || !window.ethereum) {
        return { success: false, error: "No wallet detected. Please install MetaMask." };
      }
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        const chainIdHex = await window.ethereum.request({
          method: "eth_chainId",
        });
        const chainId = parseInt(chainIdHex as string, 16);
        const chain = Object.values(SUPPORTED_CHAINS).find(
          (c) => c.chainId === chainId
        );
        return {
          success: true,
          address: (accounts as string[])[0],
          chainId,
          chainName: chain?.name || "Chain " + chainId,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as { message?: string }).message || "Failed to connect",
        };
      }
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      address: z.string().optional(),
      chainId: z.number().optional(),
      chainName: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "switchNetwork",
    description:
      "Switch the wallet to a blockchain network. Valid values: baseSepolia, arbitrumSepolia, ethereumSepolia.",
    tool: async (params?: { chainName?: string }) => {
      if (typeof window === "undefined" || !window.ethereum) {
        return { success: false, error: "No wallet detected." };
      }
      const chainKey = params?.chainName || "baseSepolia";
      const chain =
        SUPPORTED_CHAINS[chainKey as keyof typeof SUPPORTED_CHAINS];
      if (!chain) {
        return {
          success: false,
          error: "Unknown chain: " + chainKey + ". Use baseSepolia, arbitrumSepolia, or ethereumSepolia.",
        };
      }
      const hexId = "0x" + chain.chainId.toString(16);
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexId }],
        });
        return { success: true, chainId: chain.chainId, chainName: chain.name };
      } catch (err: unknown) {
        const e = err as { code?: number; message?: string };
        if (e.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: hexId,
                  chainName: chain.name,
                  rpcUrls: [chain.rpcUrl],
                  nativeCurrency: chain.nativeCurrency,
                  blockExplorerUrls: [chain.explorerUrl],
                },
              ],
            });
            return { success: true, chainId: chain.chainId, chainName: chain.name };
          } catch (addErr: unknown) {
            return {
              success: false,
              error: "Failed to add chain: " + (addErr as { message?: string }).message,
            };
          }
        }
        return { success: false, error: e.message || "Failed to switch" };
      }
    },
    inputSchema: z.object({
      chainName: z
        .string()
        .describe("Chain to switch to: baseSepolia, arbitrumSepolia, or ethereumSepolia"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      chainId: z.number().optional(),
      chainName: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "getWalletBalance",
    description:
      "Get the ETH balance of the connected wallet. Call when the user asks about their balance or before deploying.",
    tool: async () => {
      if (typeof window === "undefined" || !window.ethereum) {
        return { success: false, error: "No wallet detected." };
      }
      try {
        const accounts = (await window.ethereum.request({
          method: "eth_accounts",
        })) as string[];
        if (!accounts || accounts.length === 0) {
          return { success: false, error: "Wallet not connected." };
        }
        const balHex = (await window.ethereum.request({
          method: "eth_getBalance",
          params: [accounts[0], "latest"],
        })) as string;
        const balEth = Number(BigInt(balHex)) / 1e18;
        const chainHex = (await window.ethereum.request({
          method: "eth_chainId",
        })) as string;
        const chainId = parseInt(chainHex, 16);
        const chain = Object.values(SUPPORTED_CHAINS).find(
          (c) => c.chainId === chainId
        );
        return {
          success: true,
          address: accounts[0],
          balance: balEth.toFixed(6) + " ETH",
          chainName: chain?.name || "Chain " + chainId,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as { message?: string }).message || "Failed to get balance",
        };
      }
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      address: z.string().optional(),
      balance: z.string().optional(),
      chainName: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "globalPopulation",
    description:
      "A tool to get global population trends with optional year range filtering",
    tool: getGlobalPopulationTrend,
    inputSchema: z.object({
      startYear: z.number().optional(),
      endYear: z.number().optional(),
    }),
    outputSchema: z.object({
      data: z.array(z.object({
        year: z.number(),
        population: z.number(),
      })).optional(),
    }),
  },
];

export { InteractableContractForm };
