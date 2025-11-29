  const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const RPC_URL = process.env.RPC_URL;
  const OTC_PRIVATE_KEY = process.env.OTC_PRIVATE_KEY;
  const USER_ADDRESS = process.env.USER_ADDRESS;

  if (!RPC_URL || !OTC_PRIVATE_KEY || !USER_ADDRESS) {
    throw new Error("RPC_URL, OTC_PRIVATE_KEY e USER_ADDRESS precisam estar no .env");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(OTC_PRIVATE_KEY, provider);

  const TOKEN = process.argv[2] === "USDC"
    ? {
        symbol: "USDC",
        address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      }
    : {
        symbol: "WETH",
        address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
      };

  const erc20 = new ethers.Contract(
    TOKEN.address,
    [
      "function transfer(address to, uint256 value) returns (bool)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function balanceOf(address) view returns (uint256)",
    ],
    wallet
  );

  const decimals = await erc20.decimals();
  const symbol = await erc20.symbol();
  const otcBal = await erc20.balanceOf(wallet.address);

  console.log(`Carteira da mesa: ${wallet.address}`);
  console.log(`Token: ${symbol} (${TOKEN.address})`);
  console.log(
    `Saldo atual da mesa: ${ethers.formatUnits(otcBal, decimals)} ${symbol}`
  );

  // define quanto você quer mandar pro usuário
  // exemplo: 0.01 do token
  const amountHuman = process.argv[3] || "0.01";
  const amountWei = ethers.parseUnits(amountHuman, decimals);

  if (otcBal < amountWei) {
    throw new Error(
      `Saldo insuficiente na mesa. Tentou enviar ${amountHuman} ${symbol}`
    );
  }

  console.log(
    `Enviando ${amountHuman} ${symbol} para o usuário ${USER_ADDRESS}...`
  );
  const tx = await erc20.transfer(USER_ADDRESS, amountWei);
  console.log("Tx hash:", tx.hash);
  await tx.wait(1);
  console.log("Transferência confirmada!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
