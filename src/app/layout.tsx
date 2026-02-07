"use client";
import "./globals.css";
import { TamboProvider } from "@tambo-ai/react";
import { MCPTransport } from "@tambo-ai/react/mcp";
import { components, tools } from "@/lib/tambo";
import { contextHelpers } from "@/lib/contextHelpers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mcpServerBase =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";

  return (
    <html lang="en">
      <body>
        <TamboProvider
          apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
          components={components}
          tools={tools}
          contextHelpers={contextHelpers}
          mcpServers={[
            {
              url: `${mcpServerBase}/api/mcp/etherscan`,
              serverKey: "etherscan",
              transport: MCPTransport.HTTP,
            },
            {
              url: `${mcpServerBase}/api/mcp/supabase`,
              serverKey: "contract-db",
              transport: MCPTransport.HTTP,
            },
          ]}
        >
          {children}
        </TamboProvider>
      </body>
    </html>
  );
}