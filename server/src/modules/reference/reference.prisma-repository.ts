import type { PrismaClient } from '@prisma/client';
import type { ReferenceData, ReferenceRepository } from './reference.types.js';

export class PrismaReferenceRepository implements ReferenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async all(): Promise<ReferenceData> {
    const [departments, countries, jobLevels] = await Promise.all([
      this.prisma.department.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.country.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.jobLevel.findMany({ orderBy: { rank: 'asc' } }),
    ]);

    return {
      departments: departments.map(({ id, code, name }) => ({ id, code, name })),
      countries: countries.map(({ id, code, name, currency, usdRate, marketIndex }) => ({
        id,
        code,
        name,
        currency,
        usdRate: Number(usdRate),
        marketIndex: Number(marketIndex),
      })),
      jobLevels: jobLevels.map((level) => ({
        id: level.id,
        code: level.code,
        name: level.name,
        rank: level.rank,
        bandMinUsd: Number(level.bandMinUsd),
        bandMidUsd: Number(level.bandMidUsd),
        bandMaxUsd: Number(level.bandMaxUsd),
      })),
    };
  }
}
