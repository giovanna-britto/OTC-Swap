-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'FULFILLED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Token" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "coingeckoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" SERIAL NOT NULL,
    "quoteId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "payTokenId" INTEGER NOT NULL,
    "receiveTokenId" INTEGER NOT NULL,
    "payAmountWei" TEXT NOT NULL,
    "receiveAmountWei" TEXT NOT NULL,
    "payerAddress" TEXT,
    "chainId" INTEGER NOT NULL,
    "payTokenPriceUsd" DOUBLE PRECISION NOT NULL,
    "receiveTokenPriceUsd" DOUBLE PRECISION NOT NULL,
    "spreadBps" INTEGER NOT NULL,
    "payTxHash" TEXT,
    "payoutTxHash" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_symbol_key" ON "Token"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Token_address_key" ON "Token"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteId_key" ON "Quote"("quoteId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_payTokenId_fkey" FOREIGN KEY ("payTokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_receiveTokenId_fkey" FOREIGN KEY ("receiveTokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
