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
  --source <YOUR_SECRET_OR_ALIAS> \
  --network testnet
```

Copy the returned **Contract ID** (`C...`).

## 3. Initialize (one-time)

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <YOUR_SECRET_OR_ALIAS> \
  --network testnet \
  -- \
  init --admin <ADMIN_ADDRESS>
```

## 4. Smoke-test store + get

```bash
# Example 32-byte hex id + commitment
ID=0101010101010101010101010101010101010101010101010101010101010101
COMMIT=2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <YOUR_SECRET_OR_ALIAS> \
  --network testnet \
  -- \
  store --id $ID --commitment $COMMIT

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <YOUR_SECRET_OR_ALIAS> \
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

Update root `stellar.toml` (`[contracts] pmll_anchor = "..."`) and the commitment section of `SKILL.md` so the surface is no longer "planned".
