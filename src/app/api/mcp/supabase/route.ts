import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

const TOOLS = [
  {
    name: "getUserDeployments",
    description: "Get all contract deployments for a specific wallet address from the database",
    inputSchema: {
      type: "object",
      properties: {
        walletAddress: { type: "string", description: "Wallet address to look up" },
      },
      required: ["walletAddress"],
    },
  },
  {
    name: "getDeploymentsByChain",
    description: "Get all deployments on a specific chain",
    inputSchema: {
      type: "object",
      properties: {
        chainId: { type: "number", description: "Chain ID to filter by" },
      },
      required: ["chainId"],
    },
  },
  {
    name: "getVerificationHistory",
    description: "Get verification status history for all contracts deployed by a wallet",
    inputSchema: {
      type: "object",
      properties: {
        walletAddress: { type: "string", description: "Wallet address" },
      },
      required: ["walletAddress"],
    },
  },
  {
    name: "getDeploymentStats",
    description: "Get deployment statistics: total deployments, chains used, verified count",
    inputSchema: {
      type: "object",
      properties: {
        walletAddress: { type: "string", description: "Wallet address" },
      },
      required: ["walletAddress"],
    },
  },
  {
    name: "searchContracts",
    description: "Search deployed contracts by name or symbol",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (contract name or symbol)" },
      },
      required: ["query"],
    },
  },
];

async function handleToolCall(name: string, args: Record<string, any>) {
  const supabase = getServiceSupabase();

  switch (name) {
    case "getUserDeployments": {
      const { data, error } = await supabase
        .from("deployments")
        .select("*, verifications(*)")
        .eq("wallet_address", args.walletAddress.toLowerCase())
        .order("deployed_at", { ascending: false });
      if (error) return { error: error.message };
      return { count: data?.length || 0, deployments: data || [] };
    }

    case "getDeploymentsByChain": {
      const { data, error } = await supabase
        .from("deployments")
        .select("contract_name, symbol, contract_address, wallet_address, deployed_at")
        .eq("chain_id", args.chainId)
        .order("deployed_at", { ascending: false })
        .limit(20);
      if (error) return { error: error.message };
      return { chainId: args.chainId, count: data?.length || 0, deployments: data || [] };
    }

    case "getVerificationHistory": {
      const { data, error } = await supabase
        .from("deployments")
        .select("contract_name, contract_address, chain_name, verifications(status, verified_at)")
        .eq("wallet_address", args.walletAddress.toLowerCase());
      if (error) return { error: error.message };
      return { contracts: data || [] };
    }

    case "getDeploymentStats": {
      const { data, error } = await supabase
        .from("deployments")
        .select("chain_id, chain_name, contract_address, verifications(status)")
        .eq("wallet_address", args.walletAddress.toLowerCase());
      if (error) return { error: error.message };

      const chains = [...new Set(data?.map(d => d.chain_name) || [])];
      const verified = data?.filter(d =>
        d.verifications?.some((v: any) => v.status === "verified")
      ).length || 0;

      return {
        totalDeployments: data?.length || 0,
        chainsUsed: chains,
        verifiedContracts: verified,
        unverifiedContracts: (data?.length || 0) - verified,
      };
    }

    case "searchContracts": {
      const { data, error } = await supabase
        .from("deployments")
        .select("contract_name, symbol, contract_address, chain_name, deployed_at")
        .or(`contract_name.ilike.%${args.query}%,symbol.ilike.%${args.query}%`)
        .order("deployed_at", { ascending: false })
        .limit(10);
      if (error) return { error: error.message };
      return { results: data || [] };
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
      result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "contract-studio-db", version: "1.0.0" } },
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
  return NextResponse.json({ name: "contract-studio-db", tools: TOOLS.map(t => t.name), status: "ok" });
}