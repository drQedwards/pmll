## Preamble

```
CAP: 0090 (UNOFFICIAL DRAFT — not submitted to or numbered by stellar/stellar-protocol; upstream stops at CAP-0089)
Title: Shamir-Backed Seed Custody and Digest-Only Cross-Chain Linking (Stellar / Solana / Bitcoin / Spark)
Working Group:
    Owner: Dr. Q (drQedwards)
    Authors: Dr. Q
    Consulted: TBD
Status: Draft (unofficial)
Created: 2026-11-01
Discussion: TBD
Protocol version: N/A (no core protocol change; wallet/ecosystem-level, closer to a SEP)
```

## Simple Summary
One master seed, split with SLIP-0039 Shamir shares, derives a Stellar, Solana, Bitcoin (BIP-84/BIP-86) and Spark identity key. Linking those
addresses is proven by a SHA-256 digest anchored on Stellar via `pmll_anchor` — no keys, shares or payloads on-chain.

## Motivation
- **Custody:** a single seed phrase is a single point of failure. Shamir's (1979) k-of-n scheme over GF(256) is information-theoretically
  secure: fewer than k shares reveal nothing about the secret, regardless of attacker compute — including quantum computers.
- **Post-quantum honesty:** Shamir protects *share storage only*. Addresses derived from the recovered seed still use ed25519 (Stellar, Solana)
  and secp256k1 ECDSA/Schnorr (Bitcoin, Spark), which a cryptographically relevant quantum computer running Shor's algorithm could break.
  This CAP does **not** make signatures quantum-safe. NIST finalized FIPS 203 (ML-KEM, key encapsulation), FIPS 204 (ML-DSA, signatures) and
  FIPS 205 (SLH-DSA, stateless hash-based signatures) in August 2024. A future revision / separate CAP could add an ML-DSA or SLH-DSA signer type
  to Stellar accounts; that requires a core protocol change and is out of scope here. SHA-256 digests (the linking record) are only
  quadratically weakened by Grover (~128-bit preimage security) and are considered adequate.
- **Wallet gap:** MetaMask multichain accounts now derive EVM, Solana, Bitcoin and (since 2026-10-29) Stellar addresses from one SRP. Its Bitcoin
  support is Native SegWit only (Taproot "in the future"), and it has no Spark derivation. This draft specifies the missing Taproot + Spark paths.

## Specification
### 1. Seed splitting
- Master secret: 16–32 bytes (SLIP-0039) — or a 64-byte BIP-39 seed (supported by the reference SLIP-39 impl; note interop: standard SLIP-39
  wallets expect 128/256-bit master secrets, so wallets SHOULD split entropy, not the 64-byte seed).
- MUST use SLIP-0039 (checksummed, groups, passphrase-encrypted) rather than ad-hoc GF(256) Shamir. Recommended 3-of-5 single group.
- Shares MUST never be transmitted on-chain or to any server.

### 2. Derivation paths (from recovered seed)
| Chain | Path | Curve | Source |
|---|---|---|---|
| Stellar | `m/44'/148'/x'` | ed25519 (SLIP-0010) | SEP-0005 |
| Solana | `m/44'/501'/x'/0'` | ed25519 | Solana wallet convention (Phantom/Solflare/MetaMask) |
| Bitcoin P2WPKH | `m/84'/0'/x'/0/i` (testnet coin 1') | secp256k1 | BIP-84 (MetaMask default) |
| Bitcoin P2TR | `m/86'/0'/x'/0/i` (testnet coin 1') | secp256k1 | BIP-86 |
| Spark identity | `m/8797555'/n'/0'` (+ `1'` signing, `2'` deposit, `3'` static deposit, `4'` HTLC) | secp256k1 | docs.spark.money identity-key-derivation |

Spark: account 0 on REGTEST, default account 1 on MAINNET (per Spark docs).

### 3. Linking attestation
```
record  = canonical JSON {chain_label: public address/pubkey} (sorted keys, no whitespace)
digest  = SHA-256(record)
id      = SHA-256("cap90:link:v0")   (or per-user namespace)
on-chain: pmll_anchor.store(id, digest)   — Stellar testnet contract
          CBMEMR3R5DYQIDDV26HSDTY4H3XIUDRZFJ76MNVFLOTRRTUMYBN7LNVG (interface: init/store/get/bump)
```
Verification: holder reveals `record` off-chain; verifier recomputes digest and calls `get(id)`. Proof-of-control (signatures by each key over
the digest) is OPTIONAL and off-chain in v0.

## Design Rationale
Digest-only anchoring keeps privacy (addresses unlinkable until revealed) and fits existing contract storage. SLIP-0039 is chosen over raw Shamir
for checksums and an existing audited reference implementation (Trezor `shamir-mnemonic`).

## Security Concerns
- Recombination device sees the full seed — do it offline.
- One seed links all chains: compromise of the seed compromises all. Shamir does not mitigate a compromised recombining host.
- Quantum: see Motivation; exposed public keys (Taproot outputs, Stellar G-addresses, Spark identity) are Shor-vulnerable.
- Publishing a linking record deliberately deanonymizes the address set.

## Test Cases
See `test_cap90.py` (public BIP-39 vector "abandon ×11 about"; testnet only).

## Implementation
`cap90.py` — Python, `shamir-mnemonic` (Trezor SLIP-39 reference) + `bip_utils`. Not audited as a whole; prototype only.
