"use client";

import { TamboComponent, TamboTool, withInteractable } from "@tambo-ai/react";
import { z } from "zod";
import { ethers } from "ethers";
import StatusCard from "@/components/generative/StatusCard";
import DeploymentTracker from "@/components/generative/DeploymentTracker";
import SecurityAudit from "@/components/generative/SecurityAudit";
import GasEstimation from "@/components/generative/GasEstimation";
import ContractParamsForm, {
  contractParamsSchema,
} from "@/components/interactable/ContractParamsForm";
import { getGlobalPopulationTrend } from "@/services/population-stats";
import { SUPPORTED_CHAINS, getExplorerTxUrl } from "@/lib/chains";
import { resolveTemplate } from "@/lib/contracts/templates";

// ── Interactable: ContractParamsForm ──────────────────────
const InteractableContractForm = withInteractable(ContractParamsForm, {
  componentName: "ContractParamsForm",
  description:
    "An editable smart contract configuration form. Use this when the user wants to configure or deploy a contract. Supports ERC20, ERC721, ERC1155, Custom. Set name, symbol, features (mintable, burnable, pausable, upgradeable, ownable, access-control), initialSupply, and target chain (baseSepolia, arbitrumSepolia, ethereumSepolia).",
  propsSchema: contractParamsSchema,
});

// ── Generative Components ─────────────────────────────────
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
  {
    name: "DeploymentTracker",
    description:
      "Shows the status and result of a smart contract deployment. Use this after calling sendDeployTransaction to display the deployment status, contract address, transaction hash, and explorer links. Set status to: estimating, awaiting-signature, confirming, confirmed, or failed.",
    component: DeploymentTracker,
    propsSchema: z.object({
      status: z.string().optional().describe("Deployment status"),
      contractName: z.string().optional().describe("Name of the deployed token"),
      symbol: z.string().optional().describe("Token symbol"),
      chain: z.string().optional().describe("Chain name where deployed"),
      txHash: z.string().optional().describe("Transaction hash"),
      contractAddress: z.string().optional().describe("Deployed contract address"),
      blockNumber: z.number().optional().describe("Block number of deployment"),
      gasUsed: z.string().optional().describe("Gas used for deployment"),
      estimatedCost: z.string().optional().describe("Estimated deployment cost in ETH"),
      explorerTxUrl: z.string().optional().describe("Explorer URL for the transaction"),
      explorerContractUrl: z.string().optional().describe("Explorer URL for the contract"),
      errorMessage: z.string().optional().describe("Error message if deployment failed"),
    }),
  },
  {
    name: "SecurityAudit",
    description:
      "Display a security audit report for a smart contract. Use this when the user asks to audit, review, or check the security of their contract. Generate findings based on the contract configuration. Each finding should have severity (critical/high/medium/low/info), title, and description. The overallScore should be 0-100.",
    component: SecurityAudit,
    propsSchema: z.object({
      contractName: z.string().optional().describe("Name of the contract being audited"),
      overallScore: z.number().optional().describe("Overall security score 0-100"),
      summary: z.string().optional().describe("Brief summary of the audit results"),
      findings: z.array(z.object({
        severity: z.string().optional().describe("Finding severity: critical, high, medium, low, or info"),
        title: z.string().optional().describe("Short title of the finding"),
        description: z.string().optional().describe("Detailed description of the finding"),
      })).optional().describe("List of security findings"),
    }),
  },
  {
    name: "GasEstimation",
    description:
      "Display a gas estimation comparison across multiple chains with a visual bar chart. Use this when the user asks about deployment costs or wants to compare gas prices across chains. Show the recommended chain with the lowest cost.",
    component: GasEstimation,
    propsSchema: z.object({
      contractName: z.string().optional().describe("Name of the contract"),
      recommendedChain: z.string().optional().describe("Name of the recommended cheapest chain"),
      chains: z.array(z.object({
        chain: z.string().optional().describe("Chain name"),
        gasEstimate: z.number().optional().describe("Estimated gas units"),
        gasPriceGwei: z.number().optional().describe("Gas price in gwei"),
        estimatedCostEth: z.string().optional().describe("Estimated cost in ETH"),
        estimatedCostUsd: z.string().optional().describe("Estimated cost in USD"),
      })).optional().describe("Gas estimates per chain"),
    }),
  },
];

// ── Local Tools ───────────────────────────────────────────
export const tools: TamboTool[] = [
  // ─── Wallet Tools ───────────────────────────────────────
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

  // ─── Deploy Tools ───────────────────────────────────────
  {
    name: "getContractTemplate",
    description:
      "Get the compiled ABI and bytecode for a contract template. Call this before deploying to get the correct artifacts. Supports ERC20 with features: mintable, burnable, pausable. Returns the template name, constructor parameters needed, and available features.",
    tool: async (params?: { contractType?: string; features?: string[] }) => {
      try {
        const contractType = params?.contractType || "ERC20";
        const features = params?.features || [];
        const template = resolveTemplate(contractType, features);
        if (!template) {
          return {
            success: false,
            error: "No template found for " + contractType + " with features: " + features.join(", "),
          };
        }
        return {
          success: true,
          templateName: template.name,
          features: template.features,
          constructorParams: template.constructorParams,
          solidityVersion: template.solidityVersion,
          hasAbi: true,
          hasBytecode: true,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as { message?: string }).message || "Failed to get template",
        };
      }
    },
    inputSchema: z.object({
      contractType: z.string().describe("Contract type: ERC20"),
      features: z.array(z.string()).describe("Features: mintable, burnable, pausable"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      templateName: z.string().optional(),
      features: z.array(z.string()).optional(),
      constructorParams: z.array(z.object({
        name: z.string(),
        type: z.string(),
        description: z.string(),
      })).optional(),
      solidityVersion: z.string().optional(),
      hasAbi: z.boolean().optional(),
      hasBytecode: z.boolean().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "estimateDeployGas",
    description:
      "Estimate the gas cost to deploy a contract. Call before sendDeployTransaction to show the user the expected cost. Requires wallet connected and on the correct chain.",
    tool: async (params?: {
      contractType?: string;
      features?: string[];
      constructorArgs?: string[];
    }) => {
      if (typeof window === "undefined" || !window.ethereum) {
        return { success: false, error: "No wallet detected." };
      }
      try {
        const contractType = params?.contractType || "ERC20";
        const features = params?.features || [];
        const template = resolveTemplate(contractType, features);
        if (!template) {
          return { success: false, error: "No template found." };
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const factory = new ethers.ContractFactory(
          template.abi as ethers.InterfaceAbi,
          template.bytecode,
          signer
        );

        const args = params?.constructorArgs || ["Token", "TKN", "1000000"];
        const deployTx = await factory.getDeployTransaction(...args);
        deployTx.from = signer.address;
        const gasEstimate = await provider.estimateGas(deployTx);
        const feeData = await provider.getFeeData();
        const balance = await provider.getBalance(signer.address);

        const gasCostWei = gasEstimate * (feeData.gasPrice || BigInt(0));
        const gasCostEth = ethers.formatEther(gasCostWei);
        const balanceEth = ethers.formatEther(balance);

        return {
          success: true,
          gasEstimate: gasEstimate.toString(),
          gasPriceGwei: ethers.formatUnits(feeData.gasPrice || BigInt(0), "gwei"),
          estimatedCostEth: gasCostEth,
          walletBalance: balanceEth,
          sufficient: balance >= gasCostWei,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as { message?: string }).message || "Failed to estimate gas",
        };
      }
    },
    inputSchema: z.object({
      contractType: z.string().describe("Contract type: ERC20"),
      features: z.array(z.string()).describe("Features: mintable, burnable, pausable"),
      constructorArgs: z.array(z.string()).describe("Constructor arguments: [name, symbol, initialSupply]"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      gasEstimate: z.string().optional(),
      gasPriceGwei: z.string().optional(),
      estimatedCostEth: z.string().optional(),
      walletBalance: z.string().optional(),
      sufficient: z.boolean().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "sendDeployTransaction",
    description:
      "Deploy a smart contract to the blockchain through the user's connected wallet. Requires wallet to be connected and on the correct chain. This triggers a MetaMask popup for the user to approve. Returns the deployed contract address and transaction hash. IMPORTANT: Call getContractTemplate first to verify the template exists, then call this with the same contractType, features, and the constructorArgs [tokenName, tokenSymbol, initialSupply].",
    tool: async (params?: {
      contractType?: string;
      features?: string[];
      constructorArgs?: string[];
    }) => {
      if (typeof window === "undefined" || !window.ethereum) {
        return { success: false, error: "No wallet detected." };
      }
      try {
        const contractType = params?.contractType || "ERC20";
        const features = params?.features || [];
        const template = resolveTemplate(contractType, features);
        if (!template) {
          return { success: false, error: "No template found for " + contractType };
        }

        const args = params?.constructorArgs || [];
        if (args.length < 3) {
          return {
            success: false,
            error: "Missing constructor args. Need: [tokenName, tokenSymbol, initialSupply]",
          };
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);

        // Find chain info for explorer link
        const chain = Object.values(SUPPORTED_CHAINS).find(
          (c) => c.chainId === chainId
        );

        const factory = new ethers.ContractFactory(
          template.abi as ethers.InterfaceAbi,
          template.bytecode,
          signer
        );

        // Deploy — this triggers MetaMask popup
        const contract = await factory.deploy(...args);
        const txHash = contract.deploymentTransaction()?.hash || "";
        const explorerTxUrl = chain
          ? getExplorerTxUrl(chainId, txHash)
          : "";

        // Wait for confirmation
        const receipt = await contract.deploymentTransaction()?.wait();
        const contractAddress = await contract.getAddress();
        const explorerContractUrl = chain
          ? chain.explorerUrl + "/address/" + contractAddress
          : "";

        // Save to deployment history
        try {
          const record = {
            contractAddress,
            contractName: args[0] || "Unknown",
            symbol: args[1] || "???",
            chainId,
            chainName: chain?.name || "Chain " + chainId,
            txHash,
            blockNumber: receipt?.blockNumber || 0,
            timestamp: Date.now(),
            features: features,
            explorerContractUrl,
            explorerTxUrl,
          };
          const existing = JSON.parse(localStorage.getItem("contract-studio-deployments") || "[]");
          existing.unshift(record);
          localStorage.setItem("contract-studio-deployments", JSON.stringify(existing.slice(0, 50)));
        } catch { /* ignore storage errors */ }

        return {
          success: true,
          contractAddress,
          txHash,
          blockNumber: receipt?.blockNumber || 0,
          chainId,
          chainName: chain?.name || "Chain " + chainId,
          explorerTxUrl,
          explorerContractUrl,
          gasUsed: receipt?.gasUsed?.toString() || "0",
        };
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string; reason?: string };
        // User rejected
        if (e.code === "ACTION_REJECTED") {
          return { success: false, error: "Transaction rejected by user." };
        }
        return {
          success: false,
          error: e.reason || e.message || "Deployment failed",
        };
      }
    },
    inputSchema: z.object({
      contractType: z.string().describe("Contract type: ERC20"),
      features: z.array(z.string()).describe("Features: mintable, burnable, pausable"),
      constructorArgs: z.array(z.string()).describe("Constructor arguments: [tokenName, tokenSymbol, initialSupply as string e.g. '1000000']"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      contractAddress: z.string().optional(),
      txHash: z.string().optional(),
      blockNumber: z.number().optional(),
      chainId: z.number().optional(),
      chainName: z.string().optional(),
      explorerTxUrl: z.string().optional(),
      explorerContractUrl: z.string().optional(),
      gasUsed: z.string().optional(),
      error: z.string().optional(),
    }),
  },

  // ─── Interact Tools ──────────────────────────────────────
  {
    name: "readContract",
    description:
      "Read data from a deployed smart contract. Use for view/pure functions like balanceOf, totalSupply, name, symbol, owner, paused. Requires the contract address and function name. For balanceOf, pass the account address as the first arg.",
    tool: async (params?: {
      contractAddress?: string;
      functionName?: string;
      args?: string[];
    }) => {
      if (typeof window === "undefined" || !window.ethereum) {
        return { success: false, error: "No wallet detected." };
      }
      try {
        const addr = params?.contractAddress;
        const fnName = params?.functionName;
        if (!addr || !fnName) {
          return { success: false, error: "Need contractAddress and functionName." };
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const abi = [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function totalSupply() view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function balanceOf(address) view returns (uint256)",
          "function owner() view returns (address)",
          "function paused() view returns (bool)",
          "function allowance(address,address) view returns (uint256)",
        ];
        const contract = new ethers.Contract(addr, abi, provider);
        const args = params?.args || [];
        const result = await contract[fnName](...args);
        return { success: true, result: String(result), functionName: fnName };
      } catch (err: unknown) {
        const e = err as { reason?: string; message?: string };
        return { success: false, error: e.reason || e.message || "Read failed" };
      }
    },
    inputSchema: z.object({
      contractAddress: z.string().describe("The deployed contract address"),
      functionName: z.string().describe("Function to call: name, symbol, totalSupply, decimals, balanceOf, owner, paused"),
      args: z.array(z.string()).optional().describe("Function arguments (e.g. address for balanceOf)"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      result: z.string().optional(),
      functionName: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "callContractFunction",
    description:
      "Execute a write function on a deployed smart contract. This triggers a MetaMask popup. Supports: mint(to, amount), burn(amount), transfer(to, amount), pause(), unpause(). The amount for mint/burn/transfer should be in wei (multiply by 10^18 for whole tokens). IMPORTANT: For mint, the 'to' address should default to the user's connected wallet address unless specified otherwise.",
    tool: async (params?: {
      contractAddress?: string;
      functionName?: string;
      args?: string[];
    }) => {
      if (typeof window === "undefined" || !window.ethereum) {
        return { success: false, error: "No wallet detected." };
      }
      try {
        const addr = params?.contractAddress;
        const fnName = params?.functionName;
        if (!addr || !fnName) {
          return { success: false, error: "Need contractAddress and functionName." };
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const abi = [
          "function mint(address to, uint256 amount)",
          "function burn(uint256 amount)",
          "function transfer(address to, uint256 amount) returns (bool)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function pause()",
          "function unpause()",
          "function transferOwnership(address newOwner)",
          "function renounceOwnership()",
        ];
        const contract = new ethers.Contract(addr, abi, signer);
        const args = params?.args || [];
        const tx = await contract[fnName](...args);
        const receipt = await tx.wait();
        return {
          success: true,
          txHash: receipt.hash,
          functionName: fnName,
          gasUsed: receipt.gasUsed?.toString() || "0",
        };
      } catch (err: unknown) {
        const e = err as { code?: string; reason?: string; message?: string };
        if (e.code === "ACTION_REJECTED") {
          return { success: false, error: "Transaction rejected by user." };
        }
        return { success: false, error: e.reason || e.message || "Call failed" };
      }
    },
    inputSchema: z.object({
      contractAddress: z.string().describe("The deployed contract address"),
      functionName: z.string().describe("Function to call: mint, burn, transfer, approve, pause, unpause"),
      args: z.array(z.string()).describe("Function arguments as strings. For mint: [toAddress, amountInWei]. For burn: [amountInWei]. For transfer: [toAddress, amountInWei]."),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      txHash: z.string().optional(),
      functionName: z.string().optional(),
      gasUsed: z.string().optional(),
      error: z.string().optional(),
    }),
  },

  // ─── Template Demo Tool ─────────────────────────────────
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

// ── Export interactable for use in Workbench ────────────────
export { InteractableContractForm };
