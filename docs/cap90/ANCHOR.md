# CAP-90 linking digest — Stellar TESTNET anchor

Digest only; no keys or shares on-chain. Test vector: public BIP-39 phrase "abandon ×11 about".

- Contract (testnet): `CBMEMR3R5DYQIDDV26HSDTY4H3XIUDRZFJ76MNVFLOTRRTUMYBN7LNVG` (`pmll_anchor.store(id, commitment)`)
- id = sha256("cap90:link:v0") = `9d4b30285e4ec22ab482930aa6a5e11c0947a4342e8b13e64febb6317709757a`
- commitment = sha256(canonical JSON of derived addresses) = `41927e9b312d15a8fb24ad4881f5e911dd65dc7e5eac226be555306952da12d5`
- Tx: [`191b6498111a4f302789b93ec7be8f706c27799467be89e01cb658284b25506b`](https://stellar.expert/explorer/testnet/tx/191b6498111a4f302789b93ec7be8f706c27799467be89e01cb658284b25506b)
- Readback `get(id)` returned the same commitment.
