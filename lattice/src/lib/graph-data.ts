export type NodeKind = "hub" | "core" | "community" | "pmll" | "memory" | "protocol";

export type EdgeKind =
  | "relates_to"
  | "depends_on"
  | "implements"
  | "references"
  | "similar_to"
  | "contains";

export interface SkillNode {
  id: string;
  label: string;
  title: string;
  kind: NodeKind;
  group: string;
  summary: string;
  owner?: string;
  url?: string;
  tags: string[];
  status?: "live" | "planned";
}

export interface SkillEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  weight: number;
}

export const KIND_META: Record<
  NodeKind,
  { label: string; radius: number; fill: number }
> = {
  hub: { label: "Registry", radius: 18, fill: 1 },
  pmll: { label: "PMLL", radius: 16, fill: 0.96 },
  core: { label: "Core skill", radius: 11, fill: 0.88 },
  community: { label: "Community", radius: 8.5, fill: 0.62 },
  memory: { label: "Memory", radius: 7, fill: 0.5 },
  protocol: { label: "Protocol", radius: 7.5, fill: 0.55 },
};

export const EDGE_META: Record<EdgeKind, { label: string }> = {
  contains: { label: "contains" },
  depends_on: { label: "depends on" },
  implements: { label: "implements" },
  relates_to: { label: "relates to" },
  similar_to: { label: "similar to" },
  references: { label: "references" },
};

function node(partial: Omit<SkillNode, "title" | "tags"> & { title?: string; tags?: string[] }): SkillNode {
  return {
    title: partial.title ?? partial.label,
    tags: partial.tags ?? [],
    ...partial,
  };
}

function edge(source: string, target: string, kind: EdgeKind, weight = 1): SkillEdge {
  return { id: `${source}|${kind}|${target}`, source, target, kind, weight };
}

export const NODES: SkillNode[] = [
  node({
    id: "stellar-skills",
    label: "Stellar Skills",
    kind: "hub",
    group: "registry",
    summary:
      "Official registry of agent skills for building on the Stellar network. Core categories plus community-contributed SKILL.md files with guidance, snippets, and integration paths.",
    url: "https://skills.stellar.org",
    tags: ["registry", "agents", "stellar"],
  }),

  node({
    id: "smart-contracts",
    label: "Smart Contracts",
    title: "Stellar Smart Contracts",
    kind: "core",
    group: "core",
    summary:
      "Write, test, secure, and ship Rust smart contracts on Stellar. Covers Soroban patterns, pitfalls, and architecture.",
    owner: "stellar",
    url: "https://skills.stellar.org/skills/smart-contracts/SKILL.md",
    tags: ["soroban", "rust", "wasm"],
  }),
  node({
    id: "dapp",
    label: "Frontend & Wallets",
    kind: "core",
    group: "core",
    summary:
      "Build Stellar dApps with the JavaScript SDK, Freighter, Wallets Kit, and passkey smart accounts.",
    owner: "stellar",
    url: "https://skills.stellar.org/skills/dapp/SKILL.md",
    tags: ["javascript", "freighter", "passkeys"],
  }),
  node({
    id: "assets",
    label: "Assets & SAC",
    title: "Stellar Assets & SAC",
    kind: "core",
    group: "core",
    summary:
      "Issue and manage classic Stellar assets and trustlines, with the SAC bridge for smart-contract interop.",
    owner: "stellar",
    url: "https://skills.stellar.org/skills/assets/SKILL.md",
    tags: ["assets", "trustlines", "sac"],
  }),
  node({
    id: "data",
    label: "RPC & Horizon",
    title: "RPC & Horizon APIs",
    kind: "core",
    group: "core",
    summary:
      "Query Stellar chain data with RPC (preferred) and Horizon (legacy). Covers streaming, indexing, and migration.",
    owner: "stellar",
    url: "https://skills.stellar.org/skills/data/SKILL.md",
    tags: ["rpc", "horizon", "indexing"],
  }),
  node({
    id: "agentic-payments",
    label: "Agent Payments",
    title: "Agent Payments (x402 + MPP)",
    kind: "core",
    group: "core",
    summary:
      "Charge AI agents for API calls with x402 paywalls or MPP sessions settled over payment channels.",
    owner: "stellar",
    url: "https://skills.stellar.org/skills/agentic-payments/SKILL.md",
    tags: ["x402", "mpp", "agents"],
  }),
  node({
    id: "zk-proofs",
    label: "ZK Proofs",
    kind: "core",
    group: "core",
    summary:
      "Verify Groth16 and UltraHonk proofs on-chain via BLS12-381 and BN254, with Circom, Noir, and RISC Zero walkthroughs.",
    owner: "stellar",
    url: "https://skills.stellar.org/skills/zk-proofs/SKILL.md",
    tags: ["groth16", "noir", "bls12-381"],
  }),
  node({
    id: "standards",
    label: "SEPs & CAPs",
    title: "SEPs, CAPs & Ecosystem",
    kind: "core",
    group: "core",
    summary:
      "Pick the right SEP or CAP for a feature, with ecosystem projects, curated reference links, and MCPs.",
    owner: "stellar",
    url: "https://skills.stellar.org/skills/standards/SKILL.md",
    tags: ["sep", "cap", "ecosystem"],
  }),
  node({
    id: "cross-chain",
    label: "Cross-Chain",
    title: "Cross-Chain (CCTP, Axelar)",
    kind: "core",
    group: "core",
    summary:
      "Bridge native USDC with Circle CCTP, pass messages and tokens with Axelar GMP/ITS, and route intent-based swaps.",
    owner: "stellar",
    url: "https://skills.stellar.org/skills/cross-chain/SKILL.md",
    tags: ["cctp", "axelar", "usdc"],
  }),

  node({
    id: "openzeppelin",
    label: "OpenZeppelin",
    title: "OpenZeppelin Contracts",
    kind: "community",
    group: "contracts",
    summary:
      "Scaffold Stellar smart-contract projects with audited OpenZeppelin libraries, pausable and ownable macros.",
    owner: "OpenZeppelin",
    url: "https://github.com/OpenZeppelin/openzeppelin-skills",
    tags: ["contracts", "audit"],
  }),
  node({
    id: "defindex",
    label: "DeFindex",
    title: "DeFindex SDK",
    kind: "community",
    group: "defi",
    summary:
      "Integrate DeFindex vaults: deposits, withdrawals, APY queries, vault creation, and unsigned-XDR signing.",
    owner: "paltalabs",
    url: "https://github.com/paltalabs/defindex-sdk",
    tags: ["vaults", "defi"],
  }),
  node({
    id: "soroswap",
    label: "Soroswap",
    title: "Soroswap SDK",
    kind: "community",
    group: "defi",
    summary:
      "Trade on Soroswap DEX: swaps, liquidity ops, price routes, and signing for server keypairs or browser wallets.",
    owner: "soroswap",
    url: "https://github.com/soroswap/sdk",
    tags: ["dex", "amm"],
  }),
  node({
    id: "trustless-work",
    label: "Trustless Work",
    title: "Trustless Work Escrow",
    kind: "community",
    group: "payments",
    summary:
      "Escrow and milestone payments: single/multi-release, trustlines, disputes, REST, React SDK, or Blocks UI.",
    owner: "Trustless-Work",
    url: "https://github.com/Trustless-Work/trustless-work-dev-skill",
    tags: ["escrow", "milestones"],
  }),
  node({
    id: "webauthn",
    label: "WebAuthn",
    title: "Agent Browser WebAuthn",
    kind: "community",
    group: "wallets",
    summary:
      "Drive passkey and Stellar smart-account tests with agent-browser and Chrome DevTools virtual WebAuthn.",
    owner: "kalepail",
    url: "https://github.com/kalepail/skills",
    tags: ["passkeys", "testing"],
  }),
  node({
    id: "anchors",
    label: "Anchors",
    kind: "community",
    group: "rails",
    summary:
      "Integrate or build Stellar anchors (fiat on/off-ramps, deposits, KYC). SEP-1/6/10/12/24/31/38 flows and pitfalls.",
    owner: "CheesecakeLabs",
    url: "https://github.com/CheesecakeLabs/stellar-anchor-skill",
    tags: ["sep", "kyc", "fiat"],
  }),
  node({
    id: "eunomia",
    label: "Eunomia",
    title: "Eunomia Bounded Agent Treasury",
    kind: "community",
    group: "agents",
    summary:
      "Non-custodial, contract-bounded spending for AI agents: limits, whitelists, session keys, escrow, x402, ZK proofs.",
    owner: "eunomia-finance",
    url: "https://github.com/eunomia-finance/eunomia",
    tags: ["treasury", "agents", "zk"],
  }),
  node({
    id: "rozo-intents",
    label: "ROZO Intents",
    kind: "community",
    group: "payments",
    summary:
      "Send USDC/USDT across Stellar, Ethereum, Arbitrum, Base, BSC, Polygon, and Solana using natural language.",
    owner: "RozoAI",
    url: "https://github.com/RozoAI/rozo-intents-skills",
    tags: ["intents", "bridge"],
  }),
  node({
    id: "caatinga",
    label: "Caatinga",
    kind: "community",
    group: "contracts",
    summary:
      "Deploy and manage Soroban lifecycles with the Caatinga CLI: init → build → deploy, multi-contract graphs, bindings.",
    owner: "Dione-b",
    url: "https://github.com/Dione-b/caatinga-skill",
    tags: ["cli", "deploy"],
  }),
  node({
    id: "sozu",
    label: "Sozu Faucet",
    title: "Sozu Testnet USDC Faucet",
    kind: "community",
    group: "tooling",
    summary:
      "Claim Circle USDC on Stellar testnet with a PoW-gated CLI, using an existing or newly generated G… wallet.",
    owner: "blessedux",
    url: "https://github.com/blessedux/agent-skills",
    tags: ["testnet", "usdc", "faucet"],
  }),
  node({
    id: "lumenloop-mcp",
    label: "LumenLoop MCP",
    title: "LumenLoop MCP Connect",
    kind: "community",
    group: "lumenloop",
    summary:
      "Connect MCP clients to LumenLoop’s read-only Stellar ecosystem MCP for directory, content, and SCF data.",
    owner: "lumenloop",
    url: "https://github.com/lumenloop/lumenloop-skills",
    tags: ["mcp", "directory"],
  }),
  node({
    id: "scf-radar",
    label: "SCF Radar",
    title: "SCF Submission Radar",
    kind: "community",
    group: "lumenloop",
    summary:
      "Position a Community Fund idea against prior submissions: similar proposals, funded areas, sharper positioning.",
    owner: "lumenloop",
    url: "https://github.com/lumenloop/lumenloop-skills",
    tags: ["scf", "research"],
  }),
  node({
    id: "builder-quickstart",
    label: "Builder Quickstart",
    title: "Stellar Builder Quickstart",
    kind: "community",
    group: "lumenloop",
    summary:
      "Go from a Stellar product idea to a build path: primitives, prior art, and routing to the relevant skill.",
    owner: "lumenloop",
    url: "https://github.com/lumenloop/lumenloop-skills",
    tags: ["onboarding", "routing"],
  }),
  node({
    id: "content-auditor",
    label: "Content Auditor",
    title: "Stellar Content Auditor",
    kind: "community",
    group: "lumenloop",
    summary:
      "Audit drafts against ecosystem data: resolve names and X handles, pull citations, flag unsupported claims.",
    owner: "lumenloop",
    url: "https://github.com/lumenloop/lumenloop-skills",
    tags: ["editorial", "citations"],
  }),
  node({
    id: "eco-digest",
    label: "Ecosystem Digest",
    title: "Stellar Ecosystem Digest",
    kind: "community",
    group: "lumenloop",
    summary:
      "Produce a dated, cited digest of recent Stellar activity on a theme or entity from indexed news and talks.",
    owner: "lumenloop",
    url: "https://github.com/lumenloop/lumenloop-skills",
    tags: ["news", "research"],
  }),
  node({
    id: "eco-scout",
    label: "Ecosystem Scout",
    title: "Stellar Ecosystem Scout",
    kind: "community",
    group: "lumenloop",
    summary:
      "Map a sector of the Stellar ecosystem into projects, categories, and regions using the LumenLoop directory.",
    owner: "lumenloop",
    url: "https://github.com/lumenloop/lumenloop-skills",
    tags: ["map", "directory"],
  }),
  node({
    id: "integration-finder",
    label: "Integration Finder",
    title: "Stellar Integration Finder",
    kind: "community",
    group: "lumenloop",
    summary:
      "Find the right existing Stellar tool to integrate (wallet, oracle, anchor, DEX, indexer), then route to a skill.",
    owner: "lumenloop",
    url: "https://github.com/lumenloop/lumenloop-skills",
    tags: ["discovery", "routing"],
  }),
  node({
    id: "project-dossier",
    label: "Project Dossier",
    title: "Stellar Project Dossier",
    kind: "community",
    group: "lumenloop",
    summary:
      "Build a due-diligence profile of a Stellar project: details, content, talks, SCF history, and similar work.",
    owner: "lumenloop",
    url: "https://github.com/lumenloop/lumenloop-skills",
    tags: ["diligence", "scf"],
  }),
  node({
    id: "stellar-scout",
    label: "Stellar Scout",
    kind: "community",
    group: "research",
    summary:
      "Validate ideas against shipped projects, match SCF RFPs, draft pitches, find audits, and pull prior art from 2,000+ repos.",
    owner: "stellarlight.xyz",
    url: "https://stellarlight.xyz/scout",
    tags: ["scout", "rfp"],
  }),
  node({
    id: "sub-rosa",
    label: "Sub Rosa",
    kind: "community",
    group: "privacy",
    summary:
      "Sealed coordination: sealed-bid auctions with SAC escrow, confidential proposals, Drand-timed reveals.",
    owner: "karagozemin",
    url: "https://github.com/karagozemin/Sub-Rosa",
    tags: ["sealed", "auctions"],
  }),
  node({
    id: "rozo-checkout",
    label: "ROZO Checkout",
    kind: "community",
    group: "payments",
    summary:
      "Pay AI services with Stellar USDC via a one-time deposit order and automatic invoice settlement.",
    owner: "RozoAI",
    url: "https://github.com/RozoAI/rozo-checkout-skill",
    tags: ["checkout", "usdc"],
  }),
  node({
    id: "mpp-discover",
    label: "MPP Discover",
    kind: "community",
    group: "agents",
    summary:
      "Pay 90+ APIs with Stellar USDC through MPP Router — OpenAI, Anthropic, DeepSeek, Perplexity, Exa, and more.",
    owner: "mpprouter",
    url: "https://github.com/mpprouter/stellar-agent-wallet-skill",
    tags: ["mpp", "agents"],
  }),
  node({
    id: "agent-search",
    label: "Agent Search",
    title: "Stellar Agent Search",
    kind: "community",
    group: "agents",
    summary:
      "Keyless MCP to discover, rank, and vet on-chain Stellar 8004 agents by natural-language query, before any payment.",
    owner: "berkingurcan",
    url: "https://github.com/berkingurcan/stellar-agent-search",
    tags: ["mcp", "agents"],
  }),
  node({
    id: "cogladius",
    label: "Cogladius",
    kind: "community",
    group: "agents",
    summary:
      "Register an AI agent to earn XLM on-chain: permissionless registration, task polling, escrow payouts on a judge verdict.",
    owner: "furkanyesildag",
    url: "https://github.com/furkanyesildag/cogladius",
    tags: ["tasks", "escrow"],
  }),
  node({
    id: "soroban-mistakes",
    label: "Soroban Mistakes",
    title: "Soroban Common Mistakes",
    kind: "community",
    group: "security",
    summary:
      "Review contracts against 23 recurring security mistakes: auth, storage/TTL, overflow, panics. Checklist and CI.",
    owner: "mariaelisaaraya",
    url: "https://github.com/mariaelisaaraya/stellar-security-guide",
    tags: ["security", "review"],
  }),
  node({
    id: "stellartools",
    label: "StellarTools",
    kind: "community",
    group: "payments",
    summary:
      "Stripe-level payments: hosted checkouts, Soroban subscriptions, portals, webhooks, WooCommerce and Shopify adapters.",
    owner: "payrouteshq",
    url: "https://github.com/payrouteshq/stellartools",
    tags: ["checkout", "subscriptions"],
  }),
  node({
    id: "nirium",
    label: "Nirium",
    title: "Nirium Agentic Payments",
    kind: "community",
    group: "agents",
    summary:
      "Charge AI agents per API call on Stellar: scaffold an x402 seller, charge per route, monitor via nirium-mcp. Mainnet live.",
    owner: "nirium-protocol",
    url: "https://github.com/nirium-protocol/nirium-sdk",
    tags: ["x402", "mainnet"],
    status: "live",
  }),
  node({
    id: "contextio",
    label: "Contextio",
    title: "Contextio SDK",
    kind: "community",
    group: "legal",
    summary:
      "Bind legal context (LCP) to Stellar treasuries. SEP-53 auth, state reading, proposals, and on-chain document hashes.",
    owner: "Eras256",
    url: "https://github.com/Eras256/Contextio",
    tags: ["lcp", "sep-53"],
  }),
  node({
    id: "pmll",
    label: "PMLL",
    title: "PMLL — Persistent Memory Logic Loop",
    kind: "pmll",
    group: "pmll",
    summary:
      "Gives AI agents persistent spatial memory so they retain long-term context, form symbiotic memory layers, and keep durable state across sessions. PPM stitching, Context+ pipelines, supermodeltools/cli. 32-byte commitment anchoring: hasher and local ledger live; Soroban store awaits a verified C-address.",
    owner: "drQedwards",
    url: "https://github.com/drQedwards/pmll",
    tags: ["memory", "mcp", "context+", "ppm", "soroban"],
    status: "live",
  }),

  node({
    id: "soroban",
    label: "Soroban",
    kind: "protocol",
    group: "protocol",
    summary: "Stellar’s Rust-based smart-contract platform, compiled to wasm32v1-none.",
    url: "https://developers.stellar.org/docs/build/smart-contracts",
    tags: ["contracts", "wasm"],
  }),
  node({
    id: "x402",
    label: "x402",
    kind: "protocol",
    group: "protocol",
    summary: "HTTP 402 paywall pattern for charging AI agents per API call, settled on Stellar.",
    tags: ["payments", "agents"],
  }),
  node({
    id: "mpp",
    label: "MPP",
    title: "Machine Payment Protocol",
    kind: "protocol",
    group: "protocol",
    summary: "Per-request payment sessions for agents, settled over payment channels.",
    tags: ["payments", "channels"],
  }),
  node({
    id: "sac",
    label: "SAC",
    title: "Stellar Asset Contract",
    kind: "protocol",
    group: "protocol",
    summary: "Bridge between classic Stellar assets and Soroban smart contracts.",
    tags: ["assets", "contracts"],
  }),
  node({
    id: "cctp",
    label: "CCTP",
    title: "Circle CCTP",
    kind: "protocol",
    group: "protocol",
    summary: "Circle’s Cross-Chain Transfer Protocol for native USDC bridging onto Stellar.",
    tags: ["usdc", "bridge"],
  }),
  node({
    id: "sep-53",
    label: "SEP-53",
    title: "SEP-53 Sign In With Stellar",
    kind: "protocol",
    group: "protocol",
    summary: "Wallet authentication standard used by Contextio and other treasury apps.",
    tags: ["auth", "sep"],
  }),

  node({
    id: "kv-silo",
    label: "KV Silo",
    title: "Short-term KV silo",
    kind: "memory",
    group: "pmll",
    summary:
      "Fixed-size short-term key-value cache (default 256 slots). Agents peek before expensive tools and set on miss.",
    owner: "drQedwards",
    tags: ["cache", "short-term"],
    status: "live",
  }),
  node({
    id: "q-promise",
    label: "Q-Promise",
    title: "Q-promise chain",
    kind: "memory",
    group: "pmll",
    summary: "Async continuation registry (QMemNode) that deduplicates in-flight work inside the KV silo.",
    owner: "drQedwards",
    tags: ["async", "dedupe"],
    status: "live",
  }),
  node({
    id: "long-term-graph",
    label: "Memory Graph",
    title: "Long-term property graph",
    kind: "memory",
    group: "pmll",
    summary:
      "Typed nodes with TF-IDF embeddings, weighted edges, cosine auto-linking (≥0.72), and temporal decay e^(−λt).",
    owner: "drQedwards",
    tags: ["graph", "embeddings"],
    status: "live",
  }),
  node({
    id: "tfidf",
    label: "TF-IDF",
    title: "TF-IDF embeddings",
    kind: "memory",
    group: "pmll",
    summary: "Content embeddings on memory nodes used for cosine similarity and auto-linking.",
    owner: "drQedwards",
    tags: ["embeddings"],
    status: "live",
  }),
  node({
    id: "cosine-link",
    label: "Cosine Link",
    title: "Cosine auto-linking",
    kind: "memory",
    group: "pmll",
    summary: "Automatically draws similar_to edges when cosine similarity of two node embeddings is at least 0.72.",
    owner: "drQedwards",
    tags: ["similarity"],
    status: "live",
  }),
  node({
    id: "temporal-decay",
    label: "Decay",
    title: "Temporal decay",
    kind: "memory",
    group: "pmll",
    summary: "Scores memory by e^(−λt) and prunes stale edges plus low-access nodes to keep the graph healthy.",
    owner: "drQedwards",
    tags: ["pruning"],
    status: "live",
  }),
  node({
    id: "solution-engine",
    label: "Solution Engine",
    kind: "memory",
    group: "pmll",
    summary:
      "Bridges short-term to long-term: resolve_context, promote_to_long_term, memory_status. Auto-promotes frequent KV hits.",
    owner: "drQedwards",
    tags: ["engine", "promotion"],
    status: "live",
  }),
  node({
    id: "context-plus",
    label: "Context+",
    kind: "memory",
    group: "pmll",
    summary:
      "Long-term graph tools adapted from Context+: embeddings, cosine similarity, decay scoring, and traversal.",
    owner: "ForLoopCodes",
    url: "https://github.com/ForLoopCodes/contextplus",
    tags: ["graph", "retrieval"],
    status: "live",
  }),
  node({
    id: "mcp-server",
    label: "MCP Server",
    title: "pmll-memory-mcp",
    kind: "memory",
    group: "pmll",
    summary:
      "Exposes 15 tools to Claude and other MCP clients: 5 KV, 1 GraphQL, 6 graph, 3 engine (init, peek, set, resolve, flush).",
    owner: "drQedwards",
    tags: ["mcp", "tools"],
    status: "live",
  }),
  node({
    id: "graphql",
    label: "GraphQL",
    title: "GraphQL interface",
    kind: "memory",
    group: "pmll",
    summary: "Ad-hoc queries and mutations over the long-term memory store.",
    owner: "drQedwards",
    tags: ["query"],
    status: "live",
  }),
  node({
    id: "jsonl-store",
    label: "JSONL Store",
    kind: "memory",
    group: "pmll",
    summary: "Durable persistence via MEMORY_FILE_PATH. Docker volume keeps KV and graph across sessions.",
    owner: "drQedwards",
    tags: ["persistence"],
    status: "live",
  }),
  node({
    id: "pmll-anchor",
    label: "PMLL Anchor",
    title: "Soroban commitment anchor",
    kind: "memory",
    group: "pmll",
    summary:
      "Atomic Soroban contract for 32-byte memory commitments. Full payload stays off-chain. init / store / get / bump. Hasher and persistent ledger are live here; a verified testnet C-address is still required for on-chain store.",
    owner: "drQedwards",
    url: "https://github.com/drQedwards/pmll",
    tags: ["soroban", "commitment"],
    status: "live",
  }),
  node({
    id: "ppm-cli",
    label: "PPM / CLI",
    title: "PPM & supermodeltools CLI",
    kind: "memory",
    group: "pmll",
    summary:
      "PPM-based context stitching and supermodeltools/cli for graphing and analysis of the memory lattice.",
    owner: "drQedwards",
    tags: ["cli", "ppm"],
    status: "live",
  }),
  node({
    id: "arc-agi-3",
    label: "ARC-AGI-3",
    title: "ARC-AGI-3 Full Play Test",
    kind: "protocol",
    group: "protocol",
    summary:
      "Interactive reasoning benchmark. List games, open a scorecard, RESET, take ACTION1–7, close the card. WIN seals a 32-byte PMLL commitment.",
    url: "https://docs.arcprize.org/full-play-test",
    tags: ["arc", "agent", "scorecard"],
    status: "live",
  }),
];

export const EDGES: SkillEdge[] = [
  edge("stellar-skills", "smart-contracts", "contains", 1.2),
  edge("stellar-skills", "dapp", "contains", 1.2),
  edge("stellar-skills", "assets", "contains", 1.2),
  edge("stellar-skills", "data", "contains", 1.2),
  edge("stellar-skills", "agentic-payments", "contains", 1.2),
  edge("stellar-skills", "zk-proofs", "contains", 1.2),
  edge("stellar-skills", "standards", "contains", 1.2),
  edge("stellar-skills", "cross-chain", "contains", 1.2),
  edge("stellar-skills", "pmll", "contains", 1.4),

  edge("smart-contracts", "soroban", "implements", 1.1),
  edge("assets", "sac", "contains", 1),
  edge("agentic-payments", "x402", "contains", 1),
  edge("agentic-payments", "mpp", "contains", 1),
  edge("cross-chain", "cctp", "contains", 1),
  edge("standards", "sep-53", "contains", 0.9),
  edge("dapp", "webauthn", "relates_to", 0.8),

  edge("openzeppelin", "smart-contracts", "depends_on", 1),
  edge("openzeppelin", "stellar-skills", "relates_to", 0.5),
  edge("caatinga", "smart-contracts", "depends_on", 1),
  edge("soroban-mistakes", "smart-contracts", "references", 1),
  edge("defindex", "assets", "depends_on", 0.8),
  edge("soroswap", "assets", "depends_on", 0.8),
  edge("soroswap", "defindex", "similar_to", 0.5),
  edge("trustless-work", "assets", "depends_on", 0.7),
  edge("webauthn", "dapp", "depends_on", 0.9),
  edge("anchors", "standards", "depends_on", 1),
  edge("eunomia", "agentic-payments", "relates_to", 0.9),
  edge("eunomia", "zk-proofs", "depends_on", 0.8),
  edge("eunomia", "x402", "implements", 0.8),
  edge("rozo-intents", "cross-chain", "depends_on", 1),
  edge("rozo-intents", "rozo-checkout", "similar_to", 0.8),
  edge("rozo-checkout", "agentic-payments", "relates_to", 0.7),
  edge("sozu", "assets", "relates_to", 0.6),
  edge("sub-rosa", "sac", "depends_on", 0.9),
  edge("sub-rosa", "assets", "depends_on", 0.7),
  edge("mpp-discover", "mpp", "implements", 1.1),
  edge("mpp-discover", "agentic-payments", "depends_on", 0.9),
  edge("nirium", "x402", "implements", 1.1),
  edge("nirium", "agentic-payments", "depends_on", 1),
  edge("nirium", "mpp-discover", "similar_to", 0.7),
  edge("agent-search", "agentic-payments", "relates_to", 0.6),
  edge("cogladius", "smart-contracts", "depends_on", 0.8),
  edge("cogladius", "agentic-payments", "relates_to", 0.7),
  edge("stellartools", "dapp", "relates_to", 0.6),
  edge("stellartools", "assets", "depends_on", 0.6),
  edge("contextio", "sep-53", "implements", 1),
  edge("contextio", "standards", "depends_on", 0.8),
  edge("stellar-scout", "stellar-skills", "relates_to", 0.5),
  edge("builder-quickstart", "stellar-skills", "references", 0.8),

  edge("lumenloop-mcp", "scf-radar", "similar_to", 0.7),
  edge("lumenloop-mcp", "builder-quickstart", "similar_to", 0.7),
  edge("lumenloop-mcp", "content-auditor", "similar_to", 0.7),
  edge("lumenloop-mcp", "eco-digest", "similar_to", 0.7),
  edge("lumenloop-mcp", "eco-scout", "similar_to", 0.7),
  edge("lumenloop-mcp", "integration-finder", "similar_to", 0.7),
  edge("lumenloop-mcp", "project-dossier", "similar_to", 0.7),
  edge("integration-finder", "builder-quickstart", "relates_to", 0.6),
  edge("eco-scout", "stellar-scout", "similar_to", 0.6),
  edge("scf-radar", "project-dossier", "relates_to", 0.6),

  edge("pmll", "kv-silo", "contains", 1.2),
  edge("pmll", "long-term-graph", "contains", 1.2),
  edge("pmll", "solution-engine", "contains", 1.2),
  edge("pmll", "mcp-server", "contains", 1.1),
  edge("pmll", "pmll-anchor", "contains", 1),
  edge("pmll", "ppm-cli", "contains", 0.9),
  edge("kv-silo", "q-promise", "depends_on", 1),
  edge("long-term-graph", "context-plus", "implements", 1.1),
  edge("long-term-graph", "tfidf", "contains", 1),
  edge("long-term-graph", "cosine-link", "contains", 1),
  edge("long-term-graph", "temporal-decay", "contains", 1),
  edge("long-term-graph", "graphql", "contains", 0.9),
  edge("long-term-graph", "jsonl-store", "contains", 0.9),
  edge("solution-engine", "kv-silo", "relates_to", 1),
  edge("solution-engine", "long-term-graph", "relates_to", 1),
  edge("mcp-server", "solution-engine", "implements", 1),
  edge("mcp-server", "kv-silo", "references", 0.8),
  edge("cosine-link", "tfidf", "depends_on", 1),
  edge("temporal-decay", "long-term-graph", "relates_to", 0.6),
  edge("pmll-anchor", "soroban", "depends_on", 1.1),
  edge("pmll-anchor", "smart-contracts", "depends_on", 0.9),
  edge("pmll", "arc-agi-3", "references", 1),
  edge("arc-agi-3", "pmll-anchor", "relates_to", 0.8),
  edge("pmll", "agentic-payments", "relates_to", 0.7),
  edge("pmll", "stellar-skills", "relates_to", 0.8),
  edge("ppm-cli", "long-term-graph", "references", 0.7),
  edge("jsonl-store", "kv-silo", "relates_to", 0.5),
];

const nodeIds = new Set(NODES.map((n) => n.id));
for (const e of EDGES) {
  if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
    throw new Error(`Dangling edge ${e.id}`);
  }
}

export const GRAPH = { nodes: NODES, edges: EDGES };

export function searchNodes(query: string): SkillNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return NODES.filter((n) => {
    const hay = `${n.label} ${n.title} ${n.summary} ${n.owner ?? ""} ${n.tags.join(" ")} ${n.kind}`.toLowerCase();
    return hay.includes(q);
  });
}

export function neighborsOf(id: string): Array<{ node: SkillNode; kind: EdgeKind; direction: "in" | "out" }> {
  const byId = new Map(NODES.map((n) => [n.id, n]));
  const out: Array<{ node: SkillNode; kind: EdgeKind; direction: "in" | "out" }> = [];
  for (const e of EDGES) {
    if (e.source === id) {
      const n = byId.get(e.target);
      if (n) out.push({ node: n, kind: e.kind, direction: "out" });
    } else if (e.target === id) {
      const n = byId.get(e.source);
      if (n) out.push({ node: n, kind: e.kind, direction: "in" });
    }
  }
  return out;
}
