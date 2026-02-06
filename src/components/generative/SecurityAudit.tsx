"use client";

import React from "react";

interface Finding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
}

interface SecurityAuditProps {
  contractName?: string;
  overallScore?: number;
  findings?: Finding[];
  summary?: string;
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  critical: { color: "#EF4444", bg: "#EF4444", border: "#EF4444", icon: "🔴" },
  high: { color: "#F97316", bg: "#F97316", border: "#F97316", icon: "🟠" },
  medium: { color: "#F59E0B", bg: "#F59E0B", border: "#F59E0B", icon: "🟡" },
  low: { color: "#3B82F6", bg: "#3B82F6", border: "#3B82F6", icon: "🔵" },
  info: { color: "#6B7280", bg: "#6B7280", border: "#6B7280", icon: "⚪" },
};

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const scoreColor = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#2A2A35" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color: scoreColor }}>{score}</span>
        <span className="text-[10px] text-[#6B6B80]">/ 100</span>
      </div>
    </div>
  );
}

export default function SecurityAudit(props: SecurityAuditProps) {
  const score = props.overallScore ?? 75;
  const findings = props.findings ?? [];

  const counts: Record<string, number> = {};
  findings.forEach((f) => {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
  });

  return (
    <div className="p-5 rounded-xl bg-[#13131A] border border-[#2A2A35] space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <ScoreRing score={score} />
        <div className="flex-1 space-y-2">
          <h2 className="text-base font-semibold text-[#E8E8E8]">
            {"Security Audit"}
            {props.contractName ? ` — ${props.contractName}` : ""}
          </h2>
          {props.summary && (
            <p className="text-xs text-[#8B8BA0] leading-relaxed">{props.summary}</p>
          )}
          {/* Severity Badges */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(counts).map(([severity, count]) => {
              const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
              return (
                <span
                  key={severity}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                  style={{
                    color: cfg.color,
                    backgroundColor: cfg.bg + "15",
                    borderColor: cfg.border + "30",
                  }}
                >
                  {cfg.icon} {count} {severity}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <div className="space-y-2">
          {findings.map((finding, i) => {
            const cfg = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
            return (
              <div
                key={i}
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: cfg.bg + "08",
                  borderColor: cfg.border + "20",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: cfg.color }}>
                    {finding.severity}
                  </span>
                  <span className="text-sm text-[#E8E8E8]">{finding.title}</span>
                </div>
                <p className="text-xs text-[#8B8BA0] leading-relaxed">{finding.description}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
