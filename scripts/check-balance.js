const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const RPC_URL = process.env.RPC_URL;
  const OTC_ADDRESS = process.env.OTC_ADDRESS;
  const USER_ADDRESS = process.env.USER_ADDRESS; // adiciona isso no .env

  if (!RPC_URL || !OTC_ADDRESS || !USER_ADDRESS) {
    throw new Error("RPC_URL, OTC_ADDRESS e USER_ADDRESS precisam estar no .env");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const TOKENS = [
    {
      symbol: "WETH",
      address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    },
    {
      symbol: "USDC",
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    },
  ];

  for (const t of TOKENS) {
    const erc20 = new ethers.Contract(
      t.address,
      [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
      ],
      provider
    );

    const [decimals, symbol, otcBal, userBal] = await Promise.all([
      erc20.decimals(),
      erc20.symbol(),
      erc20.balanceOf(OTC_ADDRESS),
      erc20.balanceOf(USER_ADDRESS),
    ]);

    const fmt = (bn) => ethers.formatUnits(bn, decimals);

    console.log(`\n=== ${symbol} (${t.address}) ===`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Saldo mesa   (${OTC_ADDRESS}): ${fmt(otcBal)}`);
    console.log(`Saldo usuário(${USER_ADDRESS}): ${fmt(userBal)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
