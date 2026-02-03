"use client";

import { TamboComponent } from "@tambo-ai/react";
import { z } from "zod";
import StatusCard from "@/components/generative/StatusCard";

export const components: TamboComponent[] = [
  {
    name: "StatusCard",
    description: "A status card that displays a title, message, and colored status indicator. Use this for any informational, success, warning, or error messages.",
    component: StatusCard,
    propsSchema: z.object({
      title: z.string().optional().describe("The card title"),
      message: z.string().optional().describe("The card message body"),
      status: z
        .enum(["info", "success", "warning", "error"])
        .optional()
        .describe("The visual status: info=blue, success=green, warning=amber, error=red"),
    }),
  },
];