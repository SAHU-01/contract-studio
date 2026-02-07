import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Decode and verify the simple token
function decodeToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.exp < Date.now()) return null; // Expired
    return payload;
  } catch {
    return null;
  }
}

// GET: Fetch user's deployments
export async function GET(req: NextRequest) {
  const payload = decodeToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("deployments")
    .select("*, verifications(*)")
    .eq("wallet_address", payload.wallet)
    .order("deployed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deployments: data });
}

// POST: Save a new deployment
export async function POST(req: NextRequest) {
  const payload = decodeToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("deployments")
    .upsert(
      {
        user_id: payload.sub,
        wallet_address: payload.wallet,
        contract_address: body.contractAddress?.toLowerCase(),
        contract_name: body.contractName,
        symbol: body.symbol,
        chain_id: body.chainId,
        chain_name: body.chainName,
        tx_hash: body.txHash,
        initial_supply: body.initialSupply,
        features: body.features || [],
        explorer_url: body.explorerContractUrl,
      },
      { onConflict: "contract_address" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deployment: data });
}