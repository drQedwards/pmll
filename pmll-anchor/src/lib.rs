#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, BytesN, Env,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Commitment(BytesN<32>),
}

#[contract]
pub struct PmllAnchor;

#[contractimpl]
impl PmllAnchor {
    /// One-time init: set the admin that may call store/bump.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Atomic write of a 32-byte memory commitment.
    pub fn store(env: Env, id: BytesN<32>, commitment: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Commitment(id.clone());
        env.storage().persistent().set(&key, &commitment);
        env.storage().persistent().extend_ttl(&key, 1_000, 30 * 17_280);

        env.events().publish(
            (symbol_short!("pmll"), symbol_short!("anchor")),
            (id, commitment),
        );
    }

    pub fn get(env: Env, id: BytesN<32>) -> Option<BytesN<32>> {
        let key = DataKey::Commitment(id);
        env.storage().persistent().get(&key)
    }

    pub fn bump(env: Env, id: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let key = DataKey::Commitment(id);
        env.storage().persistent().extend_ttl(&key, 1_000, 30 * 17_280);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, BytesN, Env};

    #[test]
    fn test_init_store_get() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(PmllAnchor, ());
        let client = PmllAnchorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.init(&admin);

        let id = BytesN::from_array(&env, &[1u8; 32]);
        let commitment = BytesN::from_array(&env, &[42u8; 32]);

        client.store(&id, &commitment);
        assert_eq!(client.get(&id), Some(commitment));
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_init_panics() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(PmllAnchor, ());
        let client = PmllAnchorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.init(&admin);
        client.init(&admin);
    }
}
