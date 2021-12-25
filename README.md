# Solana mini app

This project is to learn `rust` and `solana` blockchain.

This project consists of:

- A console app to interact with the on-chain program
- An on-chain program

## Before start

Please make sure you have the following items installed:

- Rust
- Solana-cli
- Node.js
- npm

## How to run

1. Install npm dependencies

```
npm install
```

2. Start local Solana cluster

```
solana-test-validator
```

3. Setup explorer for local Solana cluster (Recommended to use Firefox browser)

   - Goto https://explorer.solana.com
   - Click the 'Mainnet Beta' button
   - Change to 'Custom RPC URL'

4. Deploy the on-chain program

```
npm run deploy:program
```

5. Run the client console app

```
npm run start
```
