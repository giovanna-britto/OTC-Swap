const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const RPC_URL = process.env.RPC_URL;
  const OTC_PRIVATE_KEY = process.env.OTC_PRIVATE_KEY;

  const TOKEN = "0xb060796d171eeeda5fb99df6b2847da6d4613cad";
  const USER = "0xBc3F4a9D020c5c304a73C6F5a82e4814F4945932";
  const AMOUNT = ethers.parseUnits("1", 6); // envia 1 token (ajuste decimal!)

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(OTC_PRIVATE_KEY, provider);

  const iface = new ethers.Interface([
    "function transfer(address to, uint256 value) returns (bool)"
  ]);

  const calldata = iface.encodeFunctionData("transfer", [USER, AMOUNT]);

  const tx = await wallet.sendTransaction({
    to: TOKEN,
    data: calldata,
  });

  console.log("Tx hash:", tx.hash);
  await tx.wait(1);
  console.log("Ok, enviado!");
}

main();
