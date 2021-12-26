# Solana mini app

This project is to learn `rust` and `solana` blockchain.

This project consists of:

- A console app to interact with the on-chain program
- An on-chain program

## Before start

Please make sure you have the following items installed:

- [Rust](https://www.rust-lang.org/tools/install)
- [Solana](https://docs.solana.com/cli/install-solana-cli-tools)
- [Node.js](https://nodejs.org/en/download/)
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

4. Build the on-chain program

```
npm run build:program
```

5. Deploy the on-chain program

```
npm run deploy:program
```

6. Run the client console app

```
npm run start
```

## Functions

### Admin module

| Name                         | Description                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Show available payout amount | Allow admin to check the remaining amount of SPL token to pay for player reward |
| Mint token for payout        | Allow admin to mint SPL token to token account for player reward                |
| Add reward to player         | Allow admin to add `claimable` reward to specific player                        |

### Player module

| Name                | Description                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Register new player | Allow player to register themselves to the program                                                                                |
| Show player details | Allow player to check their information such as wallet `SOL balance`, wallet `SPL token balance`, `upline` and `claimable reward` |
| Player claim reward | Allow player to claim reward added by the admin. The claimed `SPL token` will be transferred to player token account              |

> The current reward scheme of the program is, the upline will take 10% of the downline reward.

## Demo

1. Start the client console app

```
npm run start
```

It create a new account for the program upon startup. By default, there will be 1000 `SPL token` prefunded in program token account for payout.

2. The application should output as below.

```
Main menu
1. Admin module
2. Player module
0. Exit
Enter your choice:
```

3. Go to admin module, and the application should shows the menu for application module.

```
Admin module
1. Show available payout amount
2. Mint token for payout
3. Add reward to player
0. Back
Enter your choice:
```

4. Check the program token account by selecting `1. Show available payout amount`

```
DnTKHdUH766gBdXNN4PDB75Q7UPABt6qgVghV7Zp4E38 1000 SPL token
```

It shows that the program currently have `1000 SPL token` available for payout. And, the token account is `DnTKHdUH766gBdXNN4PDB75Q7UPABt6qgVghV7Zp4E38`. The account may different with the current documentation.

5. Let's mint another extra `1000 SPL token` by selecting `2. Mint token for payout` and enter `1000` for the amount.

```
Token minted 5WXrp8fsaP84bFjvXmrML1N7LcVcup89qrupZjUND3HCbVUU6UsUe3H75V9mT8w6gw6FHanpfh4TECyEfwaMDhmm
Mint success
```

The output shows that the token has been minted with transaction hash `5WXrp8fsaP84bFjvXmrML1N7LcVcup89qrupZjUND3HCbVUU6UsUe3H75V9mT8w6gw6FHanpfh4TECyEfwaMDhmm`

6. Check the latest available amount for payout by selecting `1. Show available payout amount`

```
DnTKHdUH766gBdXNN4PDB75Q7UPABt6qgVghV7Zp4E38 2000 SPL token
```

After step 5, the program available SPL token for payout has increased from `1000` to `2000`.

7. Let's register a new player by select `0. Back`, then select `2. Player module`.

```
Player module
1. Register new player
2. Show player details
3. Player claim reward
0. Back
Enter your choice:
```

The output above shows the menu for player module.

8. Select `1. Register new player`.

```
Player account created 5NqGB9oUUL54929Am3xUbgnNwEKZ6cwgc8dQgR2WdPLBQeZcGawvYeJaZcHDkbz1SsVXtyefTjNYYv6DrzKqoFJ2
Register player instruction 4fr7Ym8u8amyuVVEVCLbGgTQs67v7HmkNroEt9q8KgzS9hAi69oquz3XUCHVSUiyHMtaWANudBQdqwrKSz13PnQq
Token account created 3VA3SHR67enJemmqQYeez1s9Y2KCpgUSC4QRA8KsXWp7qMkGenrnbNQQUZSHsPc4A43z5xcnFzMrjxyutdUeGhVB
Player created
```

The output above shows the console app create a `player` account, `register` it with the program, and create a `token` account to receive reward.

9. Let's check the newly created player information by selecting `2. Show player details`.

```
Players
1. AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
0. Back
Enter number to view player details:
```

Now, select `1. AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW`, which is the newly created `player` account at step 9.

```
GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn 0.9962862 SOL
DfKgwZmWUDYTLPXwc6MVp4DJE8etj5X165e8vHd5tYzS 0 SPL token
Player info
Program account - AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
Has upline      - false
Reward amount   - 0
Owner           - GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn
```

The output above shows that the `player 1` wallet account is `GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn` with `0.9962862 SOL` balance. Besides that, `player 1` token wallet account is `DfKgwZmWUDYTLPXwc6MVp4DJE8etj5X165e8vHd5tYzS` with `0` balance. The `player` account for the program is `AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW`, without any upline and require `signature` from `GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn` when claim reward.

10. Let's create another player. `player 2` who having `player 1` as the upline. Select `1. Register new player`.

```
Players
1. AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
0 - No upline
Select upline or manual enter account address:
```

Select `1. AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW` (player 1) as the upline.

```
Register player instruction 2SZezkStLLxHvPMwNe6VAE5fZwrs3QBkH4ztW3CixkPGQtSywwHuuSGzcs9bMvtE8gX1CfzMYR8vqQCv73H3Zg9a
Token account created 5U2pGp15JB3HJ6u9ce4q4PjACsaMubrbPUidEBgBakpjqFiL7BJhcgqxsUSaEZrFWWiXmYCg73UJEdg7x1KMUG49
Player created
```

11. View `player 2` information by select `2. Show player details`

```
Players
1. AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
2. 4B3mZcaCpWfJ5b8KbB3PzXpvT4ed3BzKvAyrSWCyeGGT
0. Back
Enter number to view player details:
```

Then, select `2. 4B3mZcaCpWfJ5b8KbB3PzXpvT4ed3BzKvAyrSWCyeGGT` (player 2).

```
BN3bvmw5aSJnJ1pY1W4R2ZNUqATE4jhBf1k5PxgV7pYR 0.9962862 SOL
42Ch2s6SeyAiYNHWp61zA1ZkYX1N5BpPgohXVqZFKU5X 0 SPL token
Player info
Program account - 4B3mZcaCpWfJ5b8KbB3PzXpvT4ed3BzKvAyrSWCyeGGT
Has upline      - true
Upline          - AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
Reward amount   - 0
Owner           - BN3bvmw5aSJnJ1pY1W4R2ZNUqATE4jhBf1k5PxgV7pYR
```

The output shows that `player 2` upline is `AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW` which is `player 1`.

12. Let's add some reward to player by going to `Admin module` and select `3. Add reward to player`.

```
Players
1. AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
2. 4B3mZcaCpWfJ5b8KbB3PzXpvT4ed3BzKvAyrSWCyeGGT
0 - To cancel
Select player to add reward:
```

Now, select `1. AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW` (player 1) and enter `100` as the reward amount.

```
Add reward instruction 4NpuPE2KEyBeNqMJ7A5Nu58eU4VkEUuckGZ84oYwV4Neg5wddJ3BPThHcUm7g7k5tc4AaTs5Lz9ZqTzP38VSFjEk
Reward added
```

The output shows that `100` reward amount has been added to `player 1` at transaction `4NpuPE2KEyBeNqMJ7A5Nu58eU4VkEUuckGZ84oYwV4Neg5wddJ3BPThHcUm7g7k5tc4AaTs5Lz9ZqTzP38VSFjEk`.

13. Now, let's check the `claimable` reward of `player 1` by going to `player module` and select `2. Show player details`, then select `1. AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW` (player 1).

```
GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn 0.9962862 SOL
DfKgwZmWUDYTLPXwc6MVp4DJE8etj5X165e8vHd5tYzS 0 SPL token
Player info
Program account - AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
Has upline      - false
Reward amount   - 100
Owner           - GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn
```

The output shows that `player 1` has `100` claimable amount.

14. Let's add reward to `player 2`. Repeat `step 12` with `100` reward amount, but select `player 2` for the reward.
15. After the reward added to `player 2`, let's check `player 2` information by repeating `step 13`, but remember to select `player 2` during the option selection.

```
BN3bvmw5aSJnJ1pY1W4R2ZNUqATE4jhBf1k5PxgV7pYR 0.9962862 SOL
42Ch2s6SeyAiYNHWp61zA1ZkYX1N5BpPgohXVqZFKU5X 0 SPL token
Player info
Program account - 4B3mZcaCpWfJ5b8KbB3PzXpvT4ed3BzKvAyrSWCyeGGT
Has upline      - true
Upline          - AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
Reward amount   - 90
Owner           - BN3bvmw5aSJnJ1pY1W4R2ZNUqATE4jhBf1k5PxgV7pYR
```

The output shows that the `player 2` claimable reward was `90` instead of `100`. This is because `10%` of the reward will be given to upline. Let's verify this by repeating `step 13`, but select `player 1` during the option selection.

```
GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn 0.9962862 SOL
DfKgwZmWUDYTLPXwc6MVp4DJE8etj5X165e8vHd5tYzS 0 SPL token
Player info
Program account - AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
Has upline      - false
Reward amount   - 110
Owner           - GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn
```

The output shows that the `player 1` claimable reward was `110`, which are `100` (self) + `10` (from player 2).

16. Let's claim `player 1` reward by going to `player module` and select `3. Player claim reward`. Then select `1. AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW` (player 1).

```
Claim reward instruction 4mH6UBB4dUxcC8GLeznKaf45fMNG42JCWqGQDTqLp1fzqVU1Na6mBZjzxEyigLuqbfM6YNvQqBU5JHVVKRmR4tA
Claimed 110 SPL token to DfKgwZmWUDYTLPXwc6MVp4DJE8etj5X165e8vHd5tYzS
```

The output shows that `110` SPL token has been claimed to `player 1` token account `DfKgwZmWUDYTLPXwc6MVp4DJE8etj5X165e8vHd5tYzS` with transaction hash `4mH6UBB4dUxcC8GLeznKaf45fMNG42JCWqGQDTqLp1fzqVU1Na6mBZjzxEyigLuqbfM6YNvQqBU5JHVVKRmR4tA`

17. Let's check whether `player 1` received by repeating `step 13`.

```
GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn 0.9962812 SOL
DfKgwZmWUDYTLPXwc6MVp4DJE8etj5X165e8vHd5tYzS 110 SPL token
Player info
Program account - AgJdU4bohBNPPUt9F7DCizyTpmNPsdAK8fFCryFJL1WW
Has upline      - false
Reward amount   - 0
Owner           - GGy256dvjJRfttwCjZJXTYC28BCKoGLkeGxrZiag6BZn
```

Now, `player 1` has `0` claimable amount. The balance of the token account for player 1 is now `110`.

18. Lastly, let's check the program token account by going to `admin module` and select `1. Show avilable payout amount`.

```
DnTKHdUH766gBdXNN4PDB75Q7UPABt6qgVghV7Zp4E38 1890 SPL token
```

The output shows the the current available SPL token for payout is `1890` instead of `2000`. This is because `110` SPL token has been used to payout `player 1` reward at `step 16`.
