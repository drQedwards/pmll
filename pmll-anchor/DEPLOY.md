# pmll-anchor Deploy & Init (Testnet)

## Prerequisites

- Rust **1.84+** (target `wasm32v1-none` is not available before 1.84)
- `rustup target add wasm32v1-none` (re-run after every toolchain upgrade)
- `stellar` CLI on PATH (recent stable; wraps cargo for the correct target + opt)
- A funded testnet account (secret key or alias)

**Do not** build with `wasm32-unknown-unknown` on Rust 1.82+.  
`soroban-sdk` rejects that target; the Soroban runtime does not support the extra WASM features it enables.

## 1. Build

```bash
cd pmll-anchor
stellar contract build
```

Produces:

```text
target/wasm32v1-none/release/pmll_anchor.wasm
```

Raw equivalent (only if you know what you are doing):

```bash
cargo build --target wasm32v1-none --release
```

## 2. Deploy

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/pmll_anchor.wasm \
  --source-account <YOUR_SECRET_OR_ALIAS> \
  --network testnet
```

Copy the returned **Contract ID** (`C...`).

## 3. Initialize (one-time)

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account <YOUR_SECRET_OR_ALIAS> \
  --network testnet \
  -- \
  init --admin <ADMIN_ADDRESS>
```

## 4. Smoke-test store + get

```bash
# Example 32-byte hex id + commitment (64 hex chars each — not 66)
ID=0101010101010101010101010101010101010101010101010101010101010101
COMMIT=2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account <YOUR_SECRET_OR_ALIAS> \
  --network testnet \
  -- \
  store --id $ID --commitment $COMMIT

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account <YOUR_SECRET_OR_ALIAS> \
  --network testnet \
  -- \
  get --id $ID
```

Or use the native helper:

```bash
cd helper
cargo run -- hash "episode:your-payload-here"
# then paste the printed store command with the real --id <CONTRACT_ID>
```

## 5. Record

After successful deploy + init + store, record:

- Contract ID: `C...`
- Deploy tx hash
- Network: testnet

Update root `stellar.toml` (`[contracts] pmll_anchor = "..."`) and the commitment section of `SKILL.md`.

## Live testnet (2026-08-31)

| | |
|---|---|
| Contract ID | `CDLQR24LLFWXTNGGJVJCRXAF3ZRDWFZRUFTDZ5SJOT2J33CS7DDYP7IU` |
| Admin | `GBFOFCD3XDANQWSGMHKJJ2V3YXS2QQD7RNC4LMDBVNBTUJOQZ3RLSB3E` |
| Wasm hash | `1b6ad9c574e0f5c9e39968f836a410c03adcf057afa93a63d2710bd30fdd53ba` |
| Deploy tx | `2ce19becde68f1e542fc46b39285fc377ea3f77a32ead87a8e1e06d4eff8274c` |
| Init tx | `8489f4375ad32073fcb87044205f9fa2fa9511f982d73d1a703844331980593c` |
| First store tx | `1a3faca93eb54cd64ee2133287939615d96750facb7875c1c93d08765f781b6d` |

## Live mainnet (2026-08-31)

| | |
|---|---|
| Contract ID | `CCF3B64AXLS4OLY5RN4H4K2CFZAYNZCJQY5MKCKCVAKMZNH7G7F7XUUF` |
| Admin | `GBFOFCD3XDANQWSGMHKJJ2V3YXS2QQD7RNC4LMDBVNBTUJOQZ3RLSB3E` |
| Wasm hash | `1b6ad9c574e0f5c9e39968f836a410c03adcf057afa93a63d2710bd30fdd53ba` |
| Deploy tx | `d76e622d641b2465d480470f851f604a8284427a4e680c872b3ff8209c825943` |
| Init tx | `ecf3a637077d998febeac9ed5edd1a12582b5fc38db855633f2b48d40a5ba7a5` |
| First store tx | `a64481feb3aaf8d4ee1a383dfb3b1633b23df5a38d1b61d7c07f9e672f144bbf` |
