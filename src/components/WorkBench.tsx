"use client";

import { useState } from "react";
import { InteractableContractForm } from "@/lib/tambo";

const TABS = ["Deploy", "Verify", "Interact", "History"] as const;
type Tab = (typeof TABS)[number];

export default function Workbench() {
  const [activeTab, setActiveTab] = useState<Tab>("Deploy");

  return (
    <div className="flex flex-col h-full bg-[#0D0D0F]">
      {/* Tab Bar */}
      <div className="flex border-b border-[#2A2A35]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium transition-all relative ${
              activeTab === tab
                ? "text-[#00F0FF]"
                : "text-[#6B6B80] hover:text-[#E8E8E8]"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00F0FF]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "Deploy" && (
          <InteractableContractForm
            contractType="ERC20"
            name=""
            symbol=""
            initialSupply="1000000"
            features={[]}
            chain="baseSepolia"
            onPropsUpdate={(newProps) => {
              console.log("Contract form updated by AI:", newProps);
            }}
          />
        )}
        {activeTab === "Verify" && (
          <div className="text-[#6B6B80] text-sm">
            <p>Contract verification will appear here.</p>
            <p className="mt-1 text-xs">
              Try: &quot;Verify my contract on Etherscan&quot;
            </p>
          </div>
        )}
        {activeTab === "Interact" && (
          <div className="text-[#6B6B80] text-sm">
            <p>Contract interaction panel will appear here.</p>
            <p className="mt-1 text-xs">
              Try: &quot;Call the totalSupply function&quot;
            </p>
          </div>
        )}
        {activeTab === "History" && (
          <div className="text-[#6B6B80] text-sm">
            <p>Deployment history will appear here.</p>
            <p className="mt-1 text-xs">
              All your past deployments across chains.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
