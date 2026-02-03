"use client";

import { useState } from "react";

const TABS = [
  { id: "deploy", label: "Deploy" },
  { id: "verify", label: "Verify" },
  { id: "interact", label: "Interact" },
  { id: "history", label: "History" },
] as const;

export default function Workbench() {
  const [activeTab, setActiveTab] = useState<string>("deploy");

  return (
    <div className="flex flex-col h-full bg-[#0D0D0F]">
      {/* Tab Bar */}
      <div className="flex border-b border-[#2A2A35]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-[#00F0FF]"
                : "text-[#8E8E9A] hover:text-[#E8E8E8]"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00F0FF]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === "deploy" && (
          <div className="text-[#8E8E9A] text-sm">
            <p className="mb-2">Contract configuration will appear here.</p>
            <p>Try saying: &quot;I want to deploy an ERC-20 token&quot;</p>
          </div>
        )}
        {activeTab === "verify" && (
          <div className="text-[#8E8E9A] text-sm">
            Contract verification panel — coming Day 5
          </div>
        )}
        {activeTab === "interact" && (
          <div className="text-[#8E8E9A] text-sm">
            Post-deploy interaction panel — coming Day 6
          </div>
        )}
        {activeTab === "history" && (
          <div className="text-[#8E8E9A] text-sm">
            Deployment history — coming Day 4
          </div>
        )}
      </div>
    </div>
  );
}