import { NextRequest, NextResponse } from "next/server";

const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || "";

// Track pending elicitations (in-memory, fine for demo)
const pendingElicitations = new Map<string, { resolve: (value: any) => void; reject: (err: any) => void }>();

const TOOLS = [
  {
    name: "getContractInfo",
    description: "Get verification status and metadata for a smart contract from Etherscan",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Contract address" },
        chainId: { type: "number", description: "Chain ID (default: 11155111)" },
      },
      required: ["address"],
    },
  },
  {
    name: "getTokenInfo",
    description: "Get ERC-20 token information including name, symbol, decimals, total supply",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Token contract address" },
        chainId: { type: "number", description: "Chain ID (default: 11155111)" },
      },
      required: ["address"],
    },
  },
  {
    name: "getGasPrice",
    description: "Get current gas prices (low, average, high) in Gwei",
    inputSchema: {
      type: "object",
      properties: {
        chainId: { type: "number", description: "Chain ID (default: 11155111)" },
      },
    },
  },
  {
    name: "getTransactionStatus",
    description: "Check if a transaction succeeded or failed",
    inputSchema: {
      type: "object",
      properties: {
        txHash: { type: "string", description: "Transaction hash" },
        chainId: { type: "number", description: "Chain ID (default: 11155111)" },
      },
      required: ["txHash"],
    },
  },
  {
    name: "getAccountBalance",
    description: "Get ETH balance of any address",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Wallet address" },
        chainId: { type: "number", description: "Chain ID (default: 11155111)" },
      },
      required: ["address"],
    },
  },
  // NEW: Verify contract tool that uses elicitation
  {
    name: "verifyContract",
    description:
      "Verify a deployed smart contract's source code on Etherscan. Will ask the user for compiler settings if not provided.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Contract address to verify" },
        chainId: { type: "number", description: "Chain ID (default: 11155111)" },
        sourceCode: { type: "string", description: "Solidity source code" },
        contractName: { type: "string", description: "Contract name" },
        compilerVersion: { type: "string", description: "Solidity compiler version" },
        optimizationRuns: { type: "number", description: "Number of optimization runs" },
        constructorArgs: { type: "string", description: "ABI-encoded constructor arguments" },
        licenseType: { type: "number", description: "License type (1-14)" },
      },
      required: ["address"],
    },
  },
];

async function handleToolCall(
  name: string,
  args: Record<string, any>,
  meta?: Record<string, any>
) {
  const chainId = args.chainId || 11155111;

  switch (name) {
    case "getContractInfo": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${args.address}&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "1" && data.result?.[0]) {
        const c = data.result[0];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  verified: c.ABI !== "Contract source code not verified",
                  contractName: c.ContractName || "Unknown",
                  compiler: c.CompilerVersion || "Unknown",
                  optimization: c.OptimizationUsed === "1",
                  license: c.LicenseType || "None",
                },
                null,
                2
              ),
            },
          ],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ verified: false, error: "Contract not found" }) }],
      };
    }

    case "getTokenInfo": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=token&action=tokeninfo&contractaddress=${args.address}&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "1" && data.result) {
        const t = Array.isArray(data.result) ? data.result[0] : data.result;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                name: t.tokenName || t.name,
                symbol: t.symbol,
                decimals: t.divisor || t.decimals,
                totalSupply: t.totalSupply,
              }),
            },
          ],
        };
      }
      return { content: [{ type: "text", text: JSON.stringify({ error: "Token info unavailable" }) }] };
    }

    case "getGasPrice": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=gastracker&action=gasoracle&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "1" && data.result) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                low: data.result.SafeGasPrice + " Gwei",
                average: data.result.ProposeGasPrice + " Gwei",
                high: data.result.FastGasPrice + " Gwei",
              }),
            },
          ],
        };
      }
      return { content: [{ type: "text", text: JSON.stringify({ error: "Gas price unavailable" }) }] };
    }

    case "getTransactionStatus": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=transaction&action=gettxreceiptstatus&txhash=${args.txHash}&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: data.result?.status === "1" ? "Success" : "Failed",
              txHash: args.txHash,
            }),
          },
        ],
      };
    }

    case "getAccountBalance": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=balance&address=${args.address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "1") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                address: args.address,
                balance: (Number(BigInt(data.result)) / 1e18).toFixed(6) + " ETH",
              }),
            },
          ],
        };
      }
      return { content: [{ type: "text", text: JSON.stringify({ error: "Could not fetch balance" }) }] };
    }

    // ============================================================
    // NEW: verifyContract with ELICITATION
    // If the user doesn't provide compiler settings, the server
    // returns an elicitation request → Tambo renders a form in chat
    // ============================================================
    case "verifyContract": {
      const needsElicitation =
        !args.compilerVersion || !args.constructorArgs || !args.sourceCode;

      if (needsElicitation) {
        // Return elicitation request — Tambo will render this as a form
        return {
          _meta: meta || {},
          isElicitation: true,
          elicitation: {
            message: "I need a few details to verify your contract on Etherscan:",
            requestedSchema: {
              type: "object",
              properties: {
                sourceCode: {
                  type: "string",
                  title: "Source Code",
                  description: "Paste your Solidity source code",
                },
                contractName: {
                  type: "string",
                  title: "Contract Name",
                  description: "e.g. MyToken",
                },
                compilerVersion: {
                  type: "string",
                  title: "Compiler Version",
                  description: "Select the Solidity compiler version used",
                  enum: [
                    "v0.8.19+commit.7dd6d404",
                    "v0.8.20+commit.a1b79de6",
                    "v0.8.21+commit.d9974bed",
                    "v0.8.22+commit.4fc1097e",
                    "v0.8.24+commit.e11b9ed9",
                    "v0.8.26+commit.8a97fa7a",
                  ],
                },
                optimizationRuns: {
                  type: "number",
                  title: "Optimization Runs",
                  description: "Number of optimization runs (usually 200)",
                  default: 200,
                },
                constructorArgs: {
                  type: "string",
                  title: "Constructor Arguments (ABI-encoded)",
                  description:
                    "Hex-encoded constructor args. Leave empty if none.",
                  default: "",
                },
                licenseType: {
                  type: "number",
                  title: "License",
                  description: "1=Unlicense, 2=MIT, 3=GPL-2.0, 5=Apache-2.0",
                  enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
                  default: 2,
                },
              },
              required: ["sourceCode", "contractName", "compilerVersion"],
            },
          },
        };
      }

      // If we have all the data, actually call Etherscan verify API
      const apiUrl = getEtherscanApiUrl(chainId);
      const formData = new URLSearchParams({
        apikey: ETHERSCAN_API_KEY,
        module: "contract",
        action: "verifysourcecode",
        contractaddress: args.address,
        sourceCode: args.sourceCode,
        codeformat: "solidity-single-file",
        contractname: args.contractName || "MyToken",
        compilerversion: args.compilerVersion,
        optimizationUsed: args.optimizationRuns ? "1" : "0",
        runs: String(args.optimizationRuns || 200),
        constructorArguements: args.constructorArgs || "", // yes, Etherscan misspells it
        licenseType: String(args.licenseType || 2),
      });

      try {
        const resp = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });
        const data = await resp.json();

        if (data.status === "1") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  guid: data.result,
                  message: `Verification submitted! GUID: ${data.result}. Check status in ~30 seconds.`,
                  explorerUrl: `${getExplorerUrl(chainId)}/address/${args.address}#code`,
                }),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: data.result || "Verification failed",
                }),
              },
            ],
          };
        }
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: err.message }),
            },
          ],
        };
      }
    }

    default:
      return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }] };
  }
}

// Helper: get Etherscan API URL by chain
function getEtherscanApiUrl(chainId: number): string {
  switch (chainId) {
    case 1:
      return "https://api.etherscan.io/api";
    case 11155111:
      return "https://api-sepolia.etherscan.io/api";
    case 84532:
      return "https://api-sepolia.basescan.org/api";
    case 421614:
      return "https://api-sepolia.arbiscan.io/api";
    default:
      return `https://api.etherscan.io/v2/api?chainid=${chainId}`;
  }
}

// Helper: get explorer URL
function getExplorerUrl(chainId: number): string {
  switch (chainId) {
    case 1:
      return "https://etherscan.io";
    case 11155111:
      return "https://sepolia.etherscan.io";
    case 84532:
      return "https://sepolia.basescan.org";
    case 421614:
      return "https://sepolia.arbiscan.io";
    default:
      return "https://etherscan.io";
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Standard MCP: initialize
  if (body.method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          // Declare elicitation support
          elicitation: {},
        },
        serverInfo: { name: "etherscan-explorer", version: "2.0.0" },
      },
    });
  }

  // Standard MCP: tools/list
  if (body.method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id: body.id,
      result: { tools: TOOLS },
    });
  }

  // Standard MCP: tools/call
  if (body.method === "tools/call") {
    const result = await handleToolCall(
      body.params.name,
      body.params.arguments || {},
      body.params._meta
    );

    // If the tool returned an elicitation request, wrap it properly
    if ((result as any).isElicitation) {
      const { elicitation, _meta } = result as any;
      return NextResponse.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          content: [
            {
              type: "text",
              text: `I need more information to verify this contract. Please fill in the details below.`,
            },
          ],
          // The elicitation payload — Tambo picks this up and renders a form
          _meta: {
            ...(_meta || {}),
            elicitation,
          },
        },
      });
    }

    // Normal tool result
    return NextResponse.json({
      jsonrpc: "2.0",
      id: body.id,
      result: result,
    });
  }

  // Handle elicitation response (when user submits the form)
  if (body.method === "elicitation/respond") {
    const elicitationId = body.params?.elicitationId;
    const response = body.params?.response;

    if (pendingElicitations.has(elicitationId)) {
      pendingElicitations.get(elicitationId)!.resolve(response);
      pendingElicitations.delete(elicitationId);
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id: body.id,
      result: { acknowledged: true },
    });
  }

  // Standard MCP: ping
  if (body.method === "ping") {
    return NextResponse.json({ jsonrpc: "2.0", id: body.id, result: {} });
  }

  // Notifications (no response needed)
  if (body.method?.startsWith("notifications/")) {
    return NextResponse.json({ jsonrpc: "2.0", id: body.id, result: {} });
  }

  return NextResponse.json({
    jsonrpc: "2.0",
    id: body.id,
    error: { code: -32601, message: `Method not found: ${body.method}` },
  });
}

export async function GET() {
  return NextResponse.json({
    name: "etherscan-explorer",
    version: "2.0.0",
    tools: TOOLS.map((t) => t.name),
    features: ["tools", "elicitation"],
    status: "ok",
  });
}