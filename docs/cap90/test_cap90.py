import itertools, pytest
from bip_utils import Bip39SeedGenerator
from cap90 import *
# PUBLIC BIP-39 test vector mnemonic - worthless, never fund.
MN = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
SEED = Bip39SeedGenerator(MN).Generate()  # 64 bytes
MS = bytes(range(16))  # SLIP-39 test master secret

def test_slip39_any_3_of_5():
    sh = split_seed(MS, 3, 5)
    for c in itertools.combinations(sh, 3):
        assert combine_shares(list(c)) == MS

def test_slip39_2_shares_fail():
    sh = split_seed(MS, 3, 5)
    with pytest.raises(Exception):
        combine_shares(sh[:2])

def test_slip39_64byte_seed_roundtrip():
    sh = split_seed(SEED, 2, 3)
    assert combine_shares(sh[1:]) == SEED

def test_known_vectors():
    a = derive_testnet(SEED)
    assert a["stellar_testnet"] == "GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX"  # matches SEP-0005 "abandon..about" acct 0 (verify vs spec)
    assert a["solana_devnet"] == "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk"
    assert a["bitcoin_testnet_p2wpkh"] == "tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl"   # regression value (testnet)
    assert a["bitcoin_testnet_p2tr"].startswith("tb1p")
    assert len(a["spark_identity_pubkey"]) == 66

def test_attestation_digest_only():
    a = derive_testnet(SEED); att = link_attestation(a)
    assert set(att) == {"id", "digest"} and len(att["digest"]) == 64
    assert MN.split()[0] not in str(att)
