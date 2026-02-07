import { NextRequest, NextResponse } from "next/server";

const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || "";

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
];

async function handleToolCall(name: string, args: Record<string, any>) {
  const chainId = args.chainId || 11155111;

  switch (name) {
    case "getContractInfo": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${args.address}&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "1" && data.result?.[0]) {
        const c = data.result[0];
        return {
          verified: c.ABI !== "Contract source code not verified",
          contractName: c.ContractName || "Unknown",
          compiler: c.CompilerVersion || "Unknown",
          optimization: c.OptimizationUsed === "1",
          license: c.LicenseType || "None",
        };
      }
      return { verified: false, error: "Contract not found" };
    }
    case "getTokenInfo": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=token&action=tokeninfo&contractaddress=${args.address}&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "1" && data.result) {
        const t = Array.isArray(data.result) ? data.result[0] : data.result;
        return { name: t.tokenName || t.name, symbol: t.symbol, decimals: t.divisor || t.decimals, totalSupply: t.totalSupply };
      }
      return { error: "Token info unavailable" };
    }
    case "getGasPrice": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=gastracker&action=gasoracle&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "1" && data.result) {
        return { low: data.result.SafeGasPrice + " Gwei", average: data.result.ProposeGasPrice + " Gwei", high: data.result.FastGasPrice + " Gwei" };
      }
      return { error: "Gas price unavailable" };
    }
    case "getTransactionStatus": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=transaction&action=gettxreceiptstatus&txhash=${args.txHash}&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      return { status: data.result?.status === "1" ? "Success" : "Failed", txHash: args.txHash };
    }
    case "getAccountBalance": {
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=balance&address=${args.address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "1") {
        return { address: args.address, balance: (Number(BigInt(data.result)) / 1e18).toFixed(6) + " ETH" };
      }
      return { error: "Could not fetch balance" };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0", id: body.id,
      result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "etherscan-explorer", version: "1.0.0" } },
    });
  }
  if (body.method === "tools/list") {
    return NextResponse.json({ jsonrpc: "2.0", id: body.id, result: { tools: TOOLS } });
  }
  if (body.method === "tools/call") {
    const result = await handleToolCall(body.params.name, body.params.arguments || {});
    return NextResponse.json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
  }
  if (body.method === "ping") {
    return NextResponse.json({ jsonrpc: "2.0", id: body.id, result: {} });
  }
  return NextResponse.json({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `Method not found: ${body.method}` } });
}

export async function GET() {
  return NextResponse.json({ name: "etherscan-explorer", tools: TOOLS.map(t => t.name), status: "ok" });
}