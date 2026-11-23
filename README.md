# LiquidationRescue

**Policy-bounded, event-triggered rescue of lending positions, using Reactive Network Omni.**

Users set a rescue policy and fund their own reserve. When the collateral price drops, a reactive contract on Reactive Lasna asks Reactive Network to call the vault on Base Sepolia. The vault re-reads the live position, and if the health factor is below the user's trigger, it repays just enough debt to reach their target, never more than their budget or their reserve. Every decision is recorded on-chain, including the refusals.

Built for the Reactive Omni Buildathon (deadline 5 Dec 2026). Testnet only, not audited, no real funds.

## How it differs from Reactive's Aave demo

| | Reactive's Aave protection demo | LiquidationRescue |
|---|---|---|
| Trigger | CRON polling | The price-feed event itself |
| Amount | Configured action | Computed: the smallest repayment that reaches the target health factor, capped by budget and reserve |
| Limits | | Lifetime spend cap, expiry, pause, stale-price rejection, replay protection |
| Record | | One `RescueRecord` per origin event: health factor before and after, amount, outcome |

## Flow

```
Base Sepolia                      Reactive Lasna                         Base Sepolia
MockPriceOracle.PriceUpdated  →   LiquidationRescueReactive.react()  →   callback proxy → ProtectionVault.onRiskEvent()
ProtectionVault.PolicyConfigured   (tracks protected users;              (rechecks policy, price age, HF;
                                    requests one callback per user        repays via the lending adapter)
                                    on a price drop)
```

## Contracts (`contracts/contracts/`)

| Contract | Chain | Role |
|---|---|---|
| `ProtectionVault` | Base Sepolia | Callback contract (`AbstractCallback`). Policies, reserves, rescues, records |
| `LiquidationRescueReactive` | Lasna | Reactive contract (`AbstractReactive`). Subscribes via the system contract, requests callbacks with `requestCallbackV_1_0` |
| `ILendingAdapter`, `MockMarketAdapter` | Base Sepolia | What the vault needs from a lending protocol |
| `mocks/MockLendingMarket`, `MockPriceOracle`, `MockERC20` | Base Sepolia | A disclosed mock market, price feed and test tokens |

`lib/reactive-lib-omni/` is Reactive's library, vendored unmodified at a pinned commit (see `SOURCE.md`).

## Safeguards

- Callbacks must come through the callback proxy (`onlyServiceProvider`) **and** originate from our reactive contract (`onlyCallbackSender`); `react()` only accepts the system contract.
- Only the user can fund, withdraw, configure, pause or revoke. Unused reserve can always be withdrawn.
- Spend is capped per user for the policy's lifetime; reconfiguring doesn't reset it.
- Each origin log and user gives a unique event id, so a duplicate delivery is ignored and recorded.
- Prices older than `maxPriceAge` are refused, and a position with no debt left is not touched.
- Reserve is booked before the external repayment call, under a reentrancy guard, using SafeERC20; a failed repayment refunds the reserve and is recorded.
- The trigger must be above 1.0, so a policy can never wait for liquidation.

## Tests

```bash
cd contracts && npm install && npx hardhat test
```

14 tests cover every acceptance criterion: healthy, at risk and funded, insufficient reserve, budget cap, paused/expired/revoked, duplicate event, forged callbacks, stale price, unrelated events, already liquidated, withdrawals and invalid policies.

Locally, Reactive Network is played by two test stand-ins (`contracts/contracts/test/ReactiveStandIns.sol`): one at the system contract address records subscriptions and callback requests, and one delivers callbacks the way the docs describe the proxy (it overwrites the first argument with the requesting reactive contract). Real logs from real transactions are fed to `react()`. These stand-ins are for tests only; the testnet deployment uses the real network.

## Latency: every second counts

Track: **Every Second Counts** (Base Sepolia). A rescue only helps if it lands before the liquidation, so the loop is measured end to end for every rescue on record:

```bash
cd contracts
NETWORK=testnet npm run latency      # or NETWORK=local for the simulated local chain
```

`scripts/latency.ts` joins the three hops by `eventId`: the `PriceUpdated` transaction on Base Sepolia, the Lasna transaction where `react()` emitted `RescueRequested` (which carries the origin transaction hash), and the vault's `RescueEvaluated` callback on Base Sepolia. The price event and the rescue are both on Base Sepolia, so the **full loop is timed on one chain's clock**: block timestamps, plus the number of Base Sepolia blocks between them times the measured block time (about 200 ms) for sub-second detail. The split between the two hops crosses two chains' clocks and is shown as approximate. Results go to `web/src/deployments/latency-testnet.json`.

Why Reactive Omni: the rescue is driven by the price event itself, not by polling. A keeper that polls every N seconds adds up to N seconds before it even notices the drop; here the loop is one event, one `react()`, one callback.

| | Full loop (price event → rescue) | Source |
|---|---|---|
| Local chain (Reactive simulated by a relayer) | about 2 s | `NETWORK=local npm run latency`; not Reactive Network, for testing the measurement only |
| Base Sepolia ↔ Lasna | pending testnet deploy | `NETWORK=testnet npm run latency` |

## Website

`web/` serves two pages:

- **`/`**, the homepage: a liquid-metal hero (Three.js / React Three Fiber, custom GLSL), the problem as a scroll-driven price crash, the Base Sepolia → Lasna → Base Sepolia loop, an **interactive crash simulator** that runs the vault's own decision logic in the browser (`web/src/lib/rescue-sim.ts` mirrors `ProtectionVault._rescue` and `_repayToReach`; no transactions), polling vs event-driven timing, and the policy controls. Measured latency is shown only when `web/src/deployments/latency-testnet.json` exists. Reduced motion is respected throughout.
- **`/app`**, the dashboard below.

## Dashboard

```bash
# Local demo (Reactive Network simulated by a local relayer; clearly labelled in the UI)
cd contracts && npx hardhat node --hostname 127.0.0.1 --port 8546      # terminal 1
npx hardhat run scripts/dev-local.ts --network local                   # writes web/src/deployments/local.json
npx hardhat run scripts/local-relayer.ts --network local               # terminal 2
cd ../web && npm install && npm run dev                                # homepage http://127.0.0.1:3200, dashboard /app

node scripts/e2e.mjs http://127.0.0.1:3200 ./shots                     # browser e2e (E2E_WIDTH=390 for phone size)

# Against the testnet deployment (after the deploy steps below)
NEXT_PUBLIC_NETWORK=testnet npm run dev
```

On the local chain the wallet menu offers test accounts: two borrowers and the price feed operator, who can publish price moves. Each rescue in the log links its three hops: the price event, the Reactive transaction that requested the callback, and the callback on the vault.

## Deploy (testnet)

Needs a testnet wallet with Base Sepolia ETH and Lasna REACT (Reactive's faucet: send Sepolia ETH to `0x9b9BB25f1A81078C544C829c5EB7822d747Cf434`, 100 REACT per 1 SepETH, at most 5 SepETH per transaction).

```bash
cd contracts
npm run wallet                      # makes a testnet-only wallet in contracts/.env (git-ignored), prints its address and balances
# fund it: Base Sepolia ETH and Ethereum Sepolia ETH from faucets, then:
npm run faucet                      # sends 0.05 Sepolia ETH to Reactive's faucet for 5 Lasna REACT (REACT_FAUCET_ETH to change)
STEP=origin   npx hardhat run scripts/deploy.ts --network baseSepolia
STEP=reactive npx hardhat run scripts/deploy.ts --network lasna
STEP=vault    npx hardhat run scripts/deploy.ts --network baseSepolia
STEP=link     npx hardhat run scripts/deploy.ts --network lasna
```

Addresses go into `contracts/deployments.json` and `web/src/deployments/testnet.json`. Base Sepolia's callback proxy (`0x476F…3585`) and Lasna's chain ID (5318007) come from Reactive's docs.

## Status

| Piece | State |
|---|---|
| Contracts and tests | Done, 14/14 passing locally |
| Testnet deployment and real origin → Reactive → callback transaction hashes | Waiting for a funded testnet wallet |
| Dashboard (`web/`) | Done: position and health-factor gauge, policy and reserve controls, rescue preview, price feed, cross-chain rescue log. Browser e2e passes at desktop and phone width |
| Latency measurement (`scripts/latency.ts`) | Done; runs on the local chain, testnet numbers after deployment |
| Demo video | After deployment |
