// LiquidationRescue end to end, locally: real transactions emit real logs, which are delivered to the reactive
// contract's react() exactly as Reactive Network would (as the system contract, 0x8888…8888), and its callback
// requests are delivered to the vault through a proxy that injects the sender like the real callback proxy.
// Covers every acceptance criterion in the strategy's section 7.
import { expect } from "chai";
import hre from "hardhat";
import { decodeEventLog, getAddress, parseUnits, parseEther, type Hex, type TransactionReceipt } from "viem";

const SYSTEM = "0x8888888888888888888888888888888888888888" as const;
const usd = (n: number) => parseUnits(String(n), 6); // test USDC, 6 decimals
const price = (n: number) => BigInt(n) * 10n ** 8n; // 8-decimal USD price
const hf = (n: number) => BigInt(Math.round(n * 1e6)) * 10n ** 12n; // health factor, 1e18 = 1.0
const Outcome = ["None", "Rescued", "PartiallyRescued", "NotNeeded", "PolicyInactive", "PolicyPaused", "PolicyExpired",
  "BudgetExhausted", "NoReserve", "StalePrice", "AlreadyLiquidated", "RepayFailed"] as const;

async function setup() {
  const [deployer, alice, bob, liquidator] = await hre.viem.getWalletClients();
  const pub = await hre.viem.getPublicClient();
  const chainId = BigInt(await pub.getChainId());

  // Reactive Network's system contract lives at a fixed address; put the stand-in there.
  const sysImpl = await hre.viem.deployContract("MockSystemContract");
  await hre.network.provider.send("hardhat_setCode", [SYSTEM, await pub.getCode({ address: sysImpl.address })]);
  const system = await hre.viem.getContractAt("MockSystemContract", SYSTEM);

  const weth = await hre.viem.deployContract("MockERC20", ["Test WETH", "tWETH", 18]);
  const usdc = await hre.viem.deployContract("MockERC20", ["Test USDC", "tUSDC", 6]);
  const oracle = await hre.viem.deployContract("MockPriceOracle", [deployer.account.address]);
  await oracle.write.setPrice([weth.address, price(2000)]);
  const market = await hre.viem.deployContract("MockLendingMarket", [weth.address, usdc.address, oracle.address]);
  await usdc.write.mint([market.address, usd(1_000_000)]); // lending liquidity
  const adapter = await hre.viem.deployContract("MockMarketAdapter", [market.address]);

  // Deployment order from Reactive's docs: reactive contract, then the callback contract with its address, then link.
  const reactive = await hre.viem.deployContract("LiquidationRescueReactive", [deployer.account.address, chainId, oracle.address, weth.address]);
  const proxy = await hre.viem.deployContract("MockCallbackProxy");
  const vault = await hre.viem.deployContract("ProtectionVault", [proxy.address, reactive.address, adapter.address, 3600n]);
  await reactive.write.setVault([vault.address]);

  await hre.network.provider.send("hardhat_impersonateAccount", [SYSTEM]);
  await hre.network.provider.send("hardhat_setBalance", [SYSTEM, "0x56BC75E2D63100000"]);
  const asSystem = await hre.viem.getContractAt("LiquidationRescueReactive", reactive.address, { client: { wallet: await hre.viem.getWalletClient(SYSTEM) } });

  /** Delivers every log in a receipt to react(), as Reactive Network would. Returns the callbacks it requested. */
  async function relay(receipt: TransactionReceipt) {
    const requests: { payload: Hex; recipient: string }[] = [];
    for (const log of receipt.logs) {
      const topics = [...log.topics, ...Array(4 - log.topics.length).fill("0x" + "0".repeat(64))].map(t => BigInt(t as Hex));
      const tx = await asSystem.write.react([{
        chainId, contractAddress: log.address, topic0: topics[0], topic1: topics[1], topic2: topics[2], topic3: topics[3],
        data: log.data, blockNumber: receipt.blockNumber, opCode: BigInt(log.topics.length), blockHash: BigInt(receipt.blockHash),
        txHash: BigInt(receipt.transactionHash), logIndex: BigInt(log.logIndex),
      }]);
      const r = await pub.waitForTransactionReceipt({ hash: tx });
      for (const l of r.logs) {
        if (getAddress(l.address) !== getAddress(SYSTEM)) continue;
        const ev = decodeEventLog({ abi: system.abi, data: l.data, topics: l.topics });
        if (ev.eventName === "CallbackRequest") requests.push({ payload: ev.args.payload, recipient: ev.args.recipient });
      }
    }
    return requests;
  }
  const send = async (p: Promise<Hex>) => pub.waitForTransactionReceipt({ hash: await p });
  /** Delivers a requested callback through the proxy, which injects the reactive contract as sender. */
  const deliver = (req: { payload: Hex; recipient: string }) => send(proxy.write.deliver([reactive.address, req.recipient as Hex, req.payload]));
  /** Lets `wallet` borrow against `collateralEth` WETH and configure a policy, relaying the policy event. */
  async function openPosition(wallet: typeof alice, collateralEth: number, borrowUsd: number, policy?: { trigger: number; target: number; maxSpend: number; reserve: number; expiresIn?: number }) {
    const w = { client: { wallet } };
    const m = await hre.viem.getContractAt("MockLendingMarket", market.address, w);
    await (await hre.viem.getContractAt("MockERC20", weth.address, w)).write.mint([wallet.account.address, parseEther(String(collateralEth))]);
    await (await hre.viem.getContractAt("MockERC20", weth.address, w)).write.approve([market.address, parseEther(String(collateralEth))]);
    await m.write.depositCollateral([parseEther(String(collateralEth))]);
    await m.write.borrow([usd(borrowUsd)]);
    if (!policy) return;
    const v = await hre.viem.getContractAt("ProtectionVault", vault.address, w);
    const u = await hre.viem.getContractAt("MockERC20", usdc.address, w);
    await u.write.mint([wallet.account.address, usd(policy.reserve)]);
    await u.write.approve([vault.address, usd(policy.reserve)]);
    await v.write.fundReserve([usd(policy.reserve)]);
    const now = (await pub.getBlock()).timestamp;
    const r = await send(v.write.configurePolicy([hf(policy.trigger), hf(policy.target), usd(policy.maxSpend), now + BigInt(policy.expiresIn ?? 86400)]));
    await relay(r); // the reactive contract learns this user is protected
  }
  const setPrice = async (n: number) => relay(await send(oracle.write.setPrice([weth.address, price(n)])));
  const recordFor = async (req: { payload: Hex }) => {
    // eventId is the 2nd argument of onRiskEvent(address,bytes32,address,uint256).
    const eventId = ("0x" + req.payload.slice(2 + 8 + 64, 2 + 8 + 128)) as Hex;
    const r = await vault.read.getRescueRecord([eventId]);
    return { ...r, outcome: Outcome[r.outcome], eventId };
  };
  await setPrice(2000); // the reactive contract's baseline: it only acts on drops from a price it has seen
  return { deployer, alice, bob, liquidator, pub, chainId, system, weth, usdc, oracle, market, adapter, reactive, proxy, vault, relay, deliver, openPosition, setPrice, recordFor, send };
}

describe("LiquidationRescue", () => {
  it("subscribes through the Omni system contract: price feed at deploy, vault policy events after linking", async () => {
    const f = await setup();
    expect(await f.system.read.subscriptionCount()).to.equal(3n);
    const s0 = await f.system.read.subscriptions([0n]);
    expect(getAddress(s0[1])).to.equal(getAddress(f.oracle.address));
    expect(s0[3]).to.equal(BigInt(f.weth.address), "only this asset's price");
    await expect(f.reactive.write.setVault([f.vault.address])).to.be.rejectedWith("VaultAlreadySet");
  });

  it("learns protected users from the vault's own events", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 });
    expect((await f.reactive.read.protectedUsers()).map(getAddress)).to.deep.equal([getAddress(f.alice.account.address)]);
  });

  it("at-risk position with enough reserve: a price drop triggers a callback, debt falls, health factor reaches the target", async () => {
    const f = await setup();
    // 1 WETH at $2000 → $1600 borrowing power; $1200 debt → HF 1.333.
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 });
    const requests = await f.setPrice(1800); // HF falls to 1.2, below the 1.25 trigger
    expect(requests).to.have.length(1);
    await f.deliver(requests[0]);
    const rec = await f.recordFor(requests[0]);
    expect(rec.outcome).to.equal("Rescued");
    expect(rec.hfBefore).to.equal(hf(1.2));
    expect(rec.hfAfter >= hf(1.5)).to.equal(true);
    expect(rec.spent).to.equal(usd(240)); // 1440 / 1.5 = 960 allowed debt → repay 240
    expect(await f.vault.read.reserveOf([f.alice.account.address])).to.equal(usd(60));
    const [, debt] = await f.market.read.positions([f.alice.account.address]);
    expect(debt).to.equal(usd(960));
  });

  it("healthy position: a small drop is evaluated and nothing is spent; a price rise triggers nothing", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1000, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 }); // HF 1.6
    const reqs = await f.setPrice(1900); // HF 1.52, still above trigger
    await f.deliver(reqs[0]);
    expect((await f.recordFor(reqs[0])).outcome).to.equal("NotNeeded");
    expect(await f.vault.read.reserveOf([f.alice.account.address])).to.equal(usd(300));
    expect(await f.setPrice(2100)).to.have.length(0, "rises never trigger");
  });

  it("insufficient reserve: a smaller bounded repayment, recorded as partial", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 100 });
    const [req] = await f.setPrice(1800);
    await f.deliver(req);
    const rec = await f.recordFor(req);
    expect(rec.outcome).to.equal("PartiallyRescued");
    expect(rec.spent).to.equal(usd(100), "never more than the reserve");
    expect(rec.hfAfter > rec.hfBefore && rec.hfAfter < hf(1.5)).to.equal(true);
  });

  it("the lifetime spend cap holds across events, even if the user reconfigures", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 150, reserve: 1000 });
    const [r1] = await f.setPrice(1800);
    await f.deliver(r1);
    expect((await f.recordFor(r1)).spent).to.equal(usd(150));
    const [r2] = await f.setPrice(1500);
    await f.deliver(r2);
    expect((await f.recordFor(r2)).outcome).to.equal("BudgetExhausted");
    const v = await hre.viem.getContractAt("ProtectionVault", f.vault.address, { client: { wallet: f.alice } });
    const now = (await f.pub.getBlock()).timestamp;
    await v.write.configurePolicy([hf(1.25), hf(1.5), 150_000_000n, now + 1000n]);
    expect((await f.vault.read.getPolicy([f.alice.account.address])).spent).to.equal(usd(150), "reconfiguring doesn't reset spend");
  });

  it("paused, expired and revoked policies spend nothing", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 });
    await f.openPosition(f.bob, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300, expiresIn: 60 });
    const asAlice = await hre.viem.getContractAt("ProtectionVault", f.vault.address, { client: { wallet: f.alice } });
    await asAlice.write.setPaused([true]);
    await hre.network.provider.send("evm_increaseTime", [120]); // Bob's policy expires
    const reqs = await f.setPrice(1800);
    for (const r of reqs) await f.deliver(r);
    const outcomes = await Promise.all(reqs.map(f.recordFor));
    expect(outcomes.map(o => o.outcome).sort()).to.deep.equal(["PolicyExpired", "PolicyPaused"]);
    expect(outcomes.every(o => o.spent === 0n)).to.equal(true);

    const revoked = await f.send(asAlice.write.revokePolicy());
    await f.relay(revoked);
    expect((await f.reactive.read.protectedUsers()).map(getAddress)).to.deep.equal([getAddress(f.bob.account.address)], "revoked users get no more callbacks");
  });

  it("duplicate event: delivering the same callback twice cannot spend twice", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 });
    const [req] = await f.setPrice(1800);
    await f.deliver(req);
    const reserveAfterFirst = await f.vault.read.reserveOf([f.alice.account.address]);
    await f.setPrice(1800); // same price again would be a non-drop anyway; replay the same callback instead:
    const r = await f.deliver(req);
    const dup = r.logs.some(l => { try { return decodeEventLog({ abi: f.vault.abi, data: l.data, topics: l.topics }).eventName === "DuplicateEventIgnored"; } catch { return false; } });
    expect(dup).to.equal(true);
    expect(await f.vault.read.reserveOf([f.alice.account.address])).to.equal(reserveAfterFirst);
  });

  it("forged callbacks are rejected: direct calls, a different reactive sender, and react() from anyone but the system", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 });
    const [req] = await f.setPrice(1800);
    const attacker = await hre.viem.getContractAt("ProtectionVault", f.vault.address, { client: { wallet: f.bob } });
    await expect(attacker.write.onRiskEvent([f.reactive.address, ("0x" + "11".repeat(32)) as Hex, f.alice.account.address, 1n])).to.be.rejectedWith("NotAuthorized");
    await expect(f.proxy.write.deliver([f.bob.account.address, f.vault.address, req.payload])).to.be.rejectedWith("CallbackNotAuthorized");
    const r = await hre.viem.getContractAt("LiquidationRescueReactive", f.reactive.address, { client: { wallet: f.bob } });
    await expect(r.write.react([{ chainId: f.chainId, contractAddress: f.oracle.address, topic0: 0n, topic1: 0n, topic2: 0n, topic3: 0n, data: "0x", blockNumber: 0n, opCode: 0n, blockHash: 0n, txHash: 0n, logIndex: 0n }])).to.be.rejectedWith("NotAuthorized");
    expect(await f.vault.read.reserveOf([f.alice.account.address])).to.equal(usd(300));
  });

  it("stale price: no rescue on data older than the vault accepts", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 });
    const [req] = await f.setPrice(1800);
    await hre.network.provider.send("evm_increaseTime", [7200]); // callback arrives 2h after the price
    await f.deliver(req);
    expect((await f.recordFor(req)).outcome).to.equal("StalePrice");
  });

  it("price events from other feeds or other assets are ignored", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 });
    const other = await hre.viem.deployContract("MockERC20", ["Other", "OTH", 18]);
    expect(await f.relay(await f.send(f.oracle.write.setPrice([other.address, price(1)])))).to.have.length(0);
    const fakeOracle = await hre.viem.deployContract("MockPriceOracle", [f.deployer.account.address]);
    await f.send(fakeOracle.write.setPrice([f.weth.address, price(5000)]));
    expect(await f.relay(await f.send(fakeOracle.write.setPrice([f.weth.address, price(10)])))).to.have.length(0, "only the subscribed feed");
  });

  it("already liquidated: no protection is promised and nothing is spent", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 });
    // The price crashes in one block before any rescue lands, and a liquidator acts first.
    const crash = await f.send(f.oracle.write.setPrice([f.weth.address, price(1400)]));
    const liq = { client: { wallet: f.liquidator } };
    await (await hre.viem.getContractAt("MockERC20", f.usdc.address, liq)).write.mint([f.liquidator.account.address, usd(5000)]);
    await (await hre.viem.getContractAt("MockERC20", f.usdc.address, liq)).write.approve([f.market.address, usd(5000)]);
    const liqTx = await f.send((await hre.viem.getContractAt("MockLendingMarket", f.market.address, liq)).write.liquidate([f.alice.account.address]));
    // The earlier price event's callback arrives late.
    expect(liqTx.status).to.equal("success");
    const [req] = await f.relay(crash);
    await f.deliver(req);
    const rec = await f.recordFor(req);
    expect(rec.outcome).to.equal("AlreadyLiquidated");
    expect(rec.spent).to.equal(0n);
  });

  it("the owner can always withdraw unused reserve, and never more than they deposited", async () => {
    const f = await setup();
    await f.openPosition(f.alice, 1, 1200, { trigger: 1.25, target: 1.5, maxSpend: 300, reserve: 300 });
    const v = await hre.viem.getContractAt("ProtectionVault", f.vault.address, { client: { wallet: f.alice } });
    await expect(v.write.withdrawUnused([usd(301)])).to.be.rejectedWith("InsufficientReserve");
    await v.write.withdrawUnused([usd(300)]);
    expect(await f.usdc.read.balanceOf([f.alice.account.address])).to.equal(usd(1200 + 300));
  });

  it("rejects policies that would wait for liquidation or make no sense", async () => {
    const f = await setup();
    const v = await hre.viem.getContractAt("ProtectionVault", f.vault.address, { client: { wallet: f.alice } });
    const later = (await f.pub.getBlock()).timestamp + 1000n;
    await expect(v.write.configurePolicy([hf(1.0), hf(1.5), 1n, later])).to.be.rejectedWith("trigger must be above 1.0");
    await expect(v.write.configurePolicy([hf(1.5), hf(1.4), 1n, later])).to.be.rejectedWith("target must be above trigger");
    await expect(v.write.configurePolicy([hf(1.2), hf(1.5), 0n, later])).to.be.rejectedWith("max spend is zero");
  });
});
