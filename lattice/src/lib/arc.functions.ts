import { createServerFn } from "@tanstack/react-start";
import { arcUpstream } from "./arc.server";
import type { ArcUpstreamReq } from "./arc-types";

export const arcProxy = createServerFn({ method: "POST" })
  .validator((data: ArcUpstreamReq) => {
    if (!data || typeof data.path !== "string") throw new Error("path required");
    return data;
  })
  .handler(async ({ data }) => arcUpstream(data));
