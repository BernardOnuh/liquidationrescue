// Copies the ABIs the dashboard needs from the Hardhat artifacts (run `npx hardhat compile` in ../contracts first).
const fs = require("fs");
const A = "../contracts/artifacts/contracts/";
const pick = {
  ProtectionVault: "ProtectionVault.sol/ProtectionVault.json",
  LiquidationRescueReactive: "LiquidationRescueReactive.sol/LiquidationRescueReactive.json",
  MockLendingMarket: "mocks/MockLendingMarket.sol/MockLendingMarket.json",
  MockPriceOracle: "mocks/MockPriceOracle.sol/MockPriceOracle.json",
  MockERC20: "mocks/MockERC20.sol/MockERC20.json",
};
let out = "// Generated from the Hardhat artifacts by `npm run abi`. Do not edit.\n";
for (const [k, f] of Object.entries(pick)) out += `export const ${k}Abi = ${JSON.stringify(JSON.parse(fs.readFileSync(A + f)).abi)} as const;\n`;
fs.writeFileSync("src/lib/abi.ts", out);
