import { arcProxy } from "./arc.functions";
import { asLiveFrame, type ActionName, type FrameResponse, type GameInfo } from "./arc-engine";
import type { ArcJson } from "./arc-types";

function errMsg(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const o = json as { message?: string; error?: string };
    return o.message || o.error || `ARC ${status}`;
  }
  return `ARC ${status}`;
}

export class LiveArc {
  cookie = "";
  cardId: string | null = null;
  guid: string | null = null;
  gameId: string | null = null;

  private async call(path: string, body?: ArcJson): Promise<ArcJson> {
    const res = await arcProxy({
      data: { path, body, cookie: this.cookie || undefined },
    });
    if (res.cookie) this.cookie = res.cookie;
    if (!res.ok) throw new Error(errMsg(res.json, res.status));
    return res.json;
  }

  async listGames(): Promise<GameInfo[]> {
    const json = await this.call("/api/games");
    const rows = Array.isArray(json) ? json : [];
    const out: GameInfo[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const g = row as { game_id?: string; title?: string; tags?: string[] };
      out.push({
        game_id: g.game_id ?? "",
        title: g.title ?? g.game_id ?? "",
        summary: (g.tags ?? []).join(" · ") || "ARC-AGI-3 public demo",
        tags: g.tags,
      });
    }
    return out;
  }

  async openScorecard(tags = ["lattice", "full-play-test"]): Promise<string> {
    const json = (await this.call("/api/scorecard/open", { tags })) as { card_id?: string };
    this.cardId = json.card_id ?? null;
    if (!this.cardId) throw new Error("no card_id");
    return this.cardId;
  }

  async reset(game_id: string): Promise<FrameResponse> {
    if (!this.cardId) await this.openScorecard();
    const json = await this.call("/api/cmd/RESET", {
      game_id,
      card_id: this.cardId,
    });
    const frame = asLiveFrame(json, game_id);
    this.guid = frame.guid;
    this.gameId = frame.game_id;
    return frame;
  }

  async cmd(action: ActionName, xy?: { x: number; y: number }): Promise<FrameResponse> {
    if (action === "RESET") {
      if (!this.gameId) throw new Error("no game");
      this.guid = null;
      return this.reset(this.gameId);
    }
    if (!this.cardId || !this.gameId || !this.guid) throw new Error("no session");
    const body: ArcJson = {
      game_id: this.gameId,
      card_id: this.cardId,
      guid: this.guid,
    };
    if (action === "ACTION6" && xy) {
      body.x = xy.x;
      body.y = xy.y;
    }
    const json = await this.call(`/api/cmd/${action}`, body);
    const frame = asLiveFrame(json, this.gameId);
    if (frame.guid) this.guid = frame.guid;
    return frame;
  }

  async closeScorecard(): Promise<unknown> {
    if (!this.cardId) throw new Error("no scorecard");
    return this.call("/api/scorecard/close", { card_id: this.cardId });
  }
}
