import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export type Transaction = Prisma.TransactionClient;

/** Retry serialization conflicts; all callbacks must contain database operations only. */
export async function serializable<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) continue;
      throw error;
    }
  }
  throw new Error('Transaction retry limit reached');
}
