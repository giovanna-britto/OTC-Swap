const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const RPC_URL = process.env.RPC_URL;
  const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY;
  const OTC_ADDRESS = process.env.OTC_ADDRESS;

  if (!RPC_URL || !USER_PRIVATE_KEY || !OTC_ADDRESS) {
    throw new Error("RPC_URL, USER_PRIVATE_KEY e OTC_ADDRESS precisam estar no .env");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);

  const amountEth = process.argv[2] || "0.01";
  const amountWei = ethers.parseUnits(amountEth, 18);

  console.log("Enviando pagamento em ETH...");
  console.log("De:", wallet.address);
  console.log("Para (OTC):", OTC_ADDRESS);
  console.log("Valor:", amountEth, "ETH");

  const tx = await wallet.sendTransaction({
    to: OTC_ADDRESS,
    value: amountWei,
  });

  console.log("Tx enviada! hash:", tx.hash);
  console.log("Esperando 1 bloco...");
  await tx.wait(1);
  console.log("Confirmada! Use este txHash no /fulfill.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
