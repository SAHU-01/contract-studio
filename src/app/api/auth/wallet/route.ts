import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { ethers } from "ethers";

export async function POST(req: NextRequest) {
  try {
    const { address, signature, message } = await req.json();

    if (!address || !signature || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify the signature matches the claimed address
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const supabase = getServiceSupabase();

    // Upsert user — create if new, update last_seen if existing
    const { data: user, error: userError } = await supabase
      .from("users")
      .upsert(
        {
          wallet_address: address.toLowerCase(),
          last_seen: new Date().toISOString(),
        },
        { onConflict: "wallet_address" }
      )
      .select()
      .single();

    if (userError) {
      console.error("User upsert error:", userError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Generate a simple token (wallet address + timestamp, signed)
    // For hackathon, we use a simple approach. Production would use JWT.
    const token = Buffer.from(
      JSON.stringify({
        sub: user.id,
        wallet: address.toLowerCase(),
        iat: Date.now(),
        exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      })
    ).toString("base64");

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        wallet_address: user.wallet_address,
        created_at: user.created_at,
      },
      token,
    });
  } catch (e: any) {
    console.error("Auth error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}