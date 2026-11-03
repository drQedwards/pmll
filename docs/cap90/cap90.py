"""CAP-90 (UNOFFICIAL DRAFT, Dr. Q) prototype. TESTNET ONLY. Never use real keys."""
import hashlib, json
import shamir_mnemonic as slip39
from bip_utils import (Bip39SeedGenerator, Bip44, Bip44Coins, Bip84, Bip84Coins,
                       Bip86, Bip86Coins, Bip44Changes, Bip32Slip10Secp256k1)

SPARK_PURPOSE = 8797555  # last 3 bytes of SHA-256("spark") = 0x863d73 (docs.spark.money)

def split_seed(master_secret: bytes, threshold: int, shares: int, passphrase=b""):
    groups = slip39.generate_mnemonics(1, [(threshold, shares)], master_secret, passphrase)
    return groups[0]

def combine_shares(mnemonics, passphrase=b"") -> bytes:
    return slip39.combine_mnemonics(mnemonics, passphrase)

def derive_testnet(seed: bytes) -> dict:
    xlm = Bip44.FromSeed(seed, Bip44Coins.STELLAR).Purpose().Coin().Account(0)          # m/44'/148'/0'
    sol = Bip44.FromSeed(seed, Bip44Coins.SOLANA).Purpose().Coin().Account(0).Change(Bip44Changes.CHAIN_EXT)  # m/44'/501'/0'/0'
    p84 = Bip84.FromSeed(seed, Bip84Coins.BITCOIN_TESTNET).Purpose().Coin().Account(0).Change(Bip44Changes.CHAIN_EXT).AddressIndex(0)
    p86 = Bip86.FromSeed(seed, Bip86Coins.BITCOIN_TESTNET).Purpose().Coin().Account(0).Change(Bip44Changes.CHAIN_EXT).AddressIndex(0)
    spark = Bip32Slip10Secp256k1.FromSeed(seed).DerivePath(f"m/{SPARK_PURPOSE}'/0'/0'")  # regtest acct 0, identity key
    return {
        "stellar_testnet": xlm.PublicKey().ToAddress(),
        "solana_devnet": sol.PublicKey().ToAddress(),
        "bitcoin_testnet_p2wpkh": p84.PublicKey().ToAddress(),
        "bitcoin_testnet_p2tr": p86.PublicKey().ToAddress(),
        "spark_identity_pubkey": spark.PublicKey().RawCompressed().ToHex(),
    }

def link_attestation(addrs: dict) -> dict:
    """Digest-only linking record. Only `digest` goes on-chain (pmll_anchor.store)."""
    canon = json.dumps(addrs, sort_keys=True, separators=(",", ":")).encode()
    return {"id": hashlib.sha256(b"cap90:link:v0").hexdigest(),
            "digest": hashlib.sha256(canon).hexdigest()}
