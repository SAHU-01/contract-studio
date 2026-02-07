"use client";

interface StatusCardProps {
  title?: string;
  message?: string;
  status?: "info" | "success" | "warning" | "error";
}

const statusColors = {
  info: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
  success: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400" },
  warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  error: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400" },
};

export default function StatusCard({ title = "Status", message = "", status = "info" }: StatusCardProps) {
  const colors = statusColors[status] || statusColors.info;

  return (
    <div className={`rounded-lg p-4 ${colors.bg} border ${colors.border}`}>
      <h3 className={`font-semibold text-sm ${colors.text}`}>{title}</h3>
      <p className="text-sm text-[#E8E8E8] mt-1 break-all">{message}</p>
    </div>
  );
}