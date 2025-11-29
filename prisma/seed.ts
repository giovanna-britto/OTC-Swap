import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando o seed...');

  const tokens = [
    {
      symbol: 'WBTC',
      address: '0xb060796D171EeEdA5Fb99df6B2847DA6D4613CAd'.toLowerCase(),
      decimals: 8,
      coingeckoId: 'wrapped-bitcoin',
    },
    {
      symbol: 'WETH',
      address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'.toLowerCase(),
      decimals: 18,
      coingeckoId: 'weth',
    },
    {
      symbol: 'USDC',
      address: '0xba1FCc7a596140e5feC52B3aB80a8F000C9Af104'.toLowerCase(),
      decimals: 6,
      coingeckoId: 'usd-coin',
    },
  ];

  for (const t of tokens) {
    const token = await prisma.token.upsert({
      where: { symbol: t.symbol },
      update: {
        address: t.address,
        decimals: t.decimals,
        coingeckoId: t.coingeckoId,
      },
      create: {
        symbol: t.symbol,
        address: t.address,
        decimals: t.decimals,
        coingeckoId: t.coingeckoId,
      },
    });
    console.log(`Processado: ${token.symbol}`);
  }
}

main()
  .then(async () => {
    console.log('Seed de tokens concluído com sucesso');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(' Erro no seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });