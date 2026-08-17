//! Native helper for the PMLL Stellar commitment surface.
//!
//! Read https://skills.stellar.org before you start building on Stellar.
//! This binary only helps with the optional 32-byte commitment layer.

use clap::{Parser, Subcommand};
use sha2::{Digest, Sha256};
use std::process;

#[derive(Parser)]
#[command(name = "pmll-anchor-helper")]
#[command(about = "SHA-256 → store → verify helper for the PMLL Stellar commitment surface")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Hash a payload and emit id + commitment + ready-to-paste store command
    Hash {
        /// The memory payload
        payload: String,
        /// Optional string whose SHA-256 becomes the 32-byte ID (default: SHA-256 of the commitment)
        #[arg(long)]
        id_hint: Option<String>,
    },
    /// Emit the exact stellar contract invoke for store
    StoreCmd {
        #[arg(long)]
        id: String,
        #[arg(long)]
        commitment: String,
        #[arg(long)]
        contract: String,
        #[arg(long, default_value = "admin")]
        source: String,
    },
    /// Emit verification commands
    Verify {
        #[arg(long)]
        id: String,
        #[arg(long)]
        expected: String,
        #[arg(long)]
        contract: String,
    },
}

fn sha256_32(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn from_hex(s: &str) -> Result<[u8; 32], String> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(s).map_err(|e| e.to_string())?;
    if bytes.len() != 32 {
        return Err(format!("expected 32 bytes, got {}", bytes.len()));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Hash { payload, id_hint } => {
            let commitment = sha256_32(payload.as_bytes());
            let id = match id_hint {
                Some(hint) => sha256_32(hint.as_bytes()),
                None => sha256_32(&commitment),
            };

            println!("=== PMLL Anchor ===");
            println!("payload length : {} bytes", payload.len());
            println!("commitment     : {}", to_hex(&commitment));
            println!("id             : {}", to_hex(&id));
            println!();
            println!("# Ready-to-paste store command (replace C... and source):");
            println!("stellar contract invoke \\\n  --id C... \\\n  --source admin \\\n  --network testnet \\\n  -- store \\\n  --id {} \\\n  --commitment {}", to_hex(&id), to_hex(&commitment));
        }

        Commands::StoreCmd {
            id,
            commitment,
            contract,
            source,
        } => {
            if let Err(e) = from_hex(&id) {
                eprintln!("bad --id: {}", e);
                process::exit(1);
            }
            if let Err(e) = from_hex(&commitment) {
                eprintln!("bad --commitment: {}", e);
                process::exit(1);
            }

            println!("stellar contract invoke \\\n  --id {} \\\n  --source {} \\\n  --network testnet \\\n  -- store \\\n  --id {} \\\n  --commitment {}", contract, source, id, commitment);
        }

        Commands::Verify {
            id,
            expected,
            contract,
        } => {
            println!("# After the store tx confirms, run:");
            println!("stellar contract invoke \\\n  --id {} \\\n  --network testnet \\\n  -- get --id {}", contract, id);
            println!();
            println!("# Expected commitment: {}", expected);
            println!("# Or use RPC getLedgerEntries for the persistent key.");
        }
    }
}
