import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminGuard } from './admin-role.guard.js';
import { ADMIN_ACCOUNTS_REPOSITORY } from './admin-accounts.repository.js';
import { PrismaAdminAccountsRepository } from './prisma-admin-accounts.repository.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminGuard,
    { provide: ADMIN_ACCOUNTS_REPOSITORY, useClass: PrismaAdminAccountsRepository },
  ],
})
export class AdminModule {}
