"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";

export const contractParamsSchema = z.object({
  contractType: z.enum(["ERC20", "ERC721", "ERC1155", "Custom"]),
  name: z.string().describe("The token/contract name"),
  symbol: z.string().describe("The token symbol, e.g. GLX"),
  initialSupply: z.string().describe("Initial token supply as a string number"),
  features: z
    .array(z.string())
    .describe("Enabled features: mintable, burnable, pausable, upgradeable, ownable, access-control"),
  chain: z
    .string()
    .describe("Target chain: baseSepolia, arbitrumSepolia, or ethereumSepolia"),
});

export type ContractParamsProps = z.infer<typeof contractParamsSchema>;

const FEATURE_OPTIONS = [
  "mintable",
  "burnable",
  "pausable",
  "upgradeable",
  "ownable",
  "access-control",
];

const CHAIN_OPTIONS = [
  { id: "baseSepolia", name: "Base Sepolia", chainId: 84532 },
  { id: "arbitrumSepolia", name: "Arbitrum Sepolia", chainId: 421614 },
  { id: "ethereumSepolia", name: "Ethereum Sepolia", chainId: 11155111 },
];

export default function ContractParamsForm(props: ContractParamsProps) {
  const [settings, setSettings] = useState<ContractParamsProps>(props);
  const [updatedFields, setUpdatedFields] = useState<Set<string>>(new Set());
  const prevPropsRef = useRef<ContractParamsProps>(props);

  // Sync when AI updates props (same pattern as template's SettingsPanel)
  useEffect(() => {
    const prev = prevPropsRef.current;
    const changed = new Set<string>();

    if (props.name !== prev.name) changed.add("name");
    if (props.symbol !== prev.symbol) changed.add("symbol");
    if (props.initialSupply !== prev.initialSupply) changed.add("initialSupply");
    if (props.contractType !== prev.contractType) changed.add("contractType");
    if (props.chain !== prev.chain) changed.add("chain");
    if (JSON.stringify(props.features) !== JSON.stringify(prev.features))
      changed.add("features");

    setSettings(props);
    prevPropsRef.current = props;

    if (changed.size > 0) {
      setUpdatedFields(changed);
      const timer = setTimeout(() => setUpdatedFields(new Set()), 1200);
      return () => clearTimeout(timer);
    }
  }, [props]);

  const toggleFeature = (feature: string) => {
    setSettings((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const selectedChain =
    CHAIN_OPTIONS.find((c) => c.id === settings.chain) || CHAIN_OPTIONS[0];

  return (
    <div className="p-5 rounded-xl bg-[#13131A] border border-[#2A2A35] space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#E8E8E8]">
          Contract Configuration
        </h2>
        <span className="text-xs px-2 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20">
          {settings.contractType}
        </span>
      </div>

      {/* Contract Type Selector */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8888A0] uppercase tracking-wider">
          Contract Type
        </label>
        <div className="flex gap-2">
          {(["ERC20", "ERC721", "ERC1155", "Custom"] as const).map((type) => (
            <button
              key={type}
              onClick={() =>
                setSettings((prev) => ({ ...prev, contractType: type }))
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                settings.contractType === type
                  ? "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30"
                  : "bg-[#1A1A24] text-[#6B6B80] border border-[#2A2A35] hover:border-[#3A3A45]"
              } ${updatedFields.has("contractType") ? "animate-pulse" : ""}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Name + Symbol Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-[#8888A0] uppercase tracking-wider">
            Token Name
          </label>
          <input
            type="text"
            value={settings.name}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="e.g. Galaxy Token"
            className={`w-full px-3 py-2 rounded-lg bg-[#1A1A24] border border-[#2A2A35] text-[#E8E8E8] text-sm placeholder:text-[#4A4A5A] focus:outline-none focus:border-[#00F0FF]/50 ${
              updatedFields.has("name") ? "animate-pulse" : ""
            }`}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-[#8888A0] uppercase tracking-wider">
            Symbol
          </label>
          <input
            type="text"
            value={settings.symbol}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                symbol: e.target.value.toUpperCase(),
              }))
            }
            placeholder="e.g. GLX"
            className={`w-full px-3 py-2 rounded-lg bg-[#1A1A24] border border-[#2A2A35] text-[#E8E8E8] text-sm placeholder:text-[#4A4A5A] focus:outline-none focus:border-[#00F0FF]/50 ${
              updatedFields.has("symbol") ? "animate-pulse" : ""
            }`}
          />
        </div>
      </div>

      {/* Initial Supply (ERC20 only) */}
      {settings.contractType === "ERC20" && (
        <div className="space-y-1.5">
          <label className="text-xs text-[#8888A0] uppercase tracking-wider">
            Initial Supply
          </label>
          <input
            type="text"
            value={settings.initialSupply}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                initialSupply: e.target.value,
              }))
            }
            placeholder="1000000"
            className={`w-full px-3 py-2 rounded-lg bg-[#1A1A24] border border-[#2A2A35] text-[#E8E8E8] text-sm placeholder:text-[#4A4A5A] focus:outline-none focus:border-[#00F0FF]/50 ${
              updatedFields.has("initialSupply") ? "animate-pulse" : ""
            }`}
          />
          <p className="text-xs text-[#6B6B80]">
            Tokens minted to deployer. Full amount:{" "}
            {settings.initialSupply || "0"}
          </p>
        </div>
      )}

      {/* Feature Toggles */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8888A0] uppercase tracking-wider">
          Features
        </label>
        <div
          className={`flex flex-wrap gap-2 ${
            updatedFields.has("features") ? "animate-pulse" : ""
          }`}
        >
          {FEATURE_OPTIONS.map((feature) => {
            const active = settings.features.includes(feature);
            return (
              <button
                key={feature}
                onClick={() => toggleFeature(feature)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  active
                    ? "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 shadow-[0_0_8px_rgba(0,240,255,0.15)]"
                    : "bg-[#1A1A24] text-[#6B6B80] border border-[#2A2A35] hover:border-[#3A3A45]"
                }`}
              >
                {active ? "✓ " : ""}
                {feature}
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Chain */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8888A0] uppercase tracking-wider">
          Target Chain
        </label>
        <div
          className={`flex gap-2 ${
            updatedFields.has("chain") ? "animate-pulse" : ""
          }`}
        >
          {CHAIN_OPTIONS.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                setSettings((prev) => ({ ...prev, chain: c.id }))
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                settings.chain === c.id
                  ? "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30"
                  : "bg-[#1A1A24] text-[#6B6B80] border border-[#2A2A35] hover:border-[#3A3A45]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="pt-3 border-t border-[#2A2A35] flex items-center justify-between">
        <div className="text-xs text-[#6B6B80]">
          {settings.name || "Unnamed"} ({settings.symbol || "???"}) →{" "}
          {selectedChain.name}
        </div>
        <div className="text-xs text-[#00F0FF]/60">
          {settings.features.length} feature
          {settings.features.length !== 1 ? "s" : ""} enabled
        </div>
      </div>
    </div>
  );
}
