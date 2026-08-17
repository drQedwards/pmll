# pmll-anchor Deploy & Init (Testnet)

## Prerequisites
- `stellar` CLI on PATH (v27+)
- A funded testnet account (secret key or alias)
- Contract built: `stellar contract build` (produces `target/wasm32v1-none/release/pmll_anchor.wasm`)

## 1. Build
```bash
cd contracts/pmll-anchor
stellar contract build
```

## 2. Deploy
```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/pmll_anchor.wasm \
  --source <YOUR_SECRET_OR_ALIAS> \
  --network testnet
```
→ Copy the returned **Contract ID** (starts with `C...`)

## 3. Initialize (one-time)
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <YOUR_SECRET_OR_ALIAS> \
  --network testnet \
  -- \
  init --admin <ADMIN_ADDRESS>
```
Use the same address that controls the key, or a dedicated admin.

## 4. Smoke-test store + get
```bash
# Generate a 32-byte id and commitment (example)
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

## 5. Record for SKILL.md / stellar.toml
After successful deploy + init + store, note:
- Contract ID: `C...`
- Deploy tx hash: (from the deploy response or explorer)
- Network: testnet

Then replace `REPLACE_WITH_PMll_ANCHOR_CONTRACT_ID` in `stellar.toml` with the real Contract ID.
