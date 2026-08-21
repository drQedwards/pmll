export type ArcJson =
  | string
  | number
  | boolean
  | null
  | ArcJson[]
  | { [key: string]: ArcJson };

export interface ArcUpstreamReq {
  path: string;
  method?: "GET" | "POST";
  body?: ArcJson;
  cookie?: string;
}
