import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { ScreeningModule } from './screening/screening.module.js';

@Module({
  imports: [PrismaModule, ScreeningModule],
})
export class AppModule {}
