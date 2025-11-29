const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const RPC_URL = process.env.RPC_URL;
  const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY;

  if (!RPC_URL || !USER_PRIVATE_KEY) {
    throw new Error("RPC_URL e USER_PRIVATE_KEY precisam estar no .env");
  }

  const TOKEN_ADDRESS = process.env.PAY_TOKEN_ADDRESS; 
  const CALLDATA = process.env.PAYMENT_CALLDATA;       

  if (!TOKEN_ADDRESS || !CALLDATA) {
    throw new Error(
      "Defina PAY_TOKEN_ADDRESS e PAYMENT_CALLDATA no .env com base na resposta do /quote"
    );
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);

  console.log("Enviando pagamento ERC20...");
  console.log("De:", wallet.address);
  console.log("Contrato do token:", TOKEN_ADDRESS);

  const tx = await wallet.sendTransaction({
    to: TOKEN_ADDRESS,
    data: CALLDATA,
    value: 0n,
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
