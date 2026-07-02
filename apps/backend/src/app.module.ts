import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { FamiliesModule } from './families/families.module.js';
import { ScreeningModule } from './screening/screening.module.js';
import { AnalysisModule } from './analysis/analysis.module.js';

@Module({
  imports: [PrismaModule, FamiliesModule, ScreeningModule, AnalysisModule],
})
export class AppModule {}
