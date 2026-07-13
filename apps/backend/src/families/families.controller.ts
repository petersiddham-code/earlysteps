import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { Child, Family, User } from '@earlysteps/shared-types';
import { FamiliesService } from './families.service.js';
import { CreateFamilyDto } from './dto/create-family.dto.js';
import { CreateChildDto } from './dto/create-child.dto.js';
import { UpdateConsentDto } from './dto/update-consent.dto.js';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { OptionalUser } from '../auth/optional-user.decorator.js';
import { FamilyOwnershipGuard } from './family-ownership.guard.js';

/**
 * Issue #23: OptionalJwtAuthGuard populates `request.user` (or null for a guest caller)
 * without ever rejecting the request itself; FamilyOwnershipGuard then decides, per route,
 * whether that's good enough — unowned/guest families stay fully open, owned ones require
 * a matching account. createFamily has no :familyId/:childId param yet, so the ownership
 * guard is a no-op there; it only reads whichever user OptionalJwtAuthGuard resolved.
 */
@UseGuards(OptionalJwtAuthGuard, FamilyOwnershipGuard)
@Controller('families')
export class FamiliesController {
  constructor(
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(FamiliesService) private readonly familiesService: FamiliesService,
  ) {}

  @Post()
  createFamily(
    @Body() dto: CreateFamilyDto,
    @OptionalUser() user: User | null,
  ): Promise<Family> {
    return this.familiesService.createFamily(
      { locale: dto.locale, lowBandwidthMode: dto.low_bandwidth_mode },
      user?.id ?? null,
    );
  }

  @Get(':familyId')
  getFamily(@Param('familyId') familyId: string): Promise<Family> {
    return this.familiesService.getFamily(familyId);
  }

  /** Child switcher's data source (issue #23) — every child recorded under this family. */
  @Get(':familyId/children')
  getChildren(@Param('familyId') familyId: string): Promise<Child[]> {
    return this.familiesService.getChildren(familyId);
  }

  @Patch(':familyId/consent')
  updateConsent(
    @Param('familyId') familyId: string,
    @Body() dto: UpdateConsentDto,
  ): Promise<Family> {
    return this.familiesService.updateConsent(familyId, dto.scope, dto.granted);
  }

  @Post(':familyId/children')
  createChild(
    @Param('familyId') familyId: string,
    @Body() dto: CreateChildDto,
  ): Promise<Child> {
    return this.familiesService.createChild(familyId, {
      nickname: dto.nickname,
      birthMonth: dto.birth_month,
      birthYear: dto.birth_year,
      gender: dto.gender,
      genderDetail: dto.gender_detail,
      languages: dto.languages,
    });
  }

  /** Right-to-erasure (issue #55): deletes the family and everything under it. 204 on success. */
  @Delete(':familyId')
  @HttpCode(204)
  async deleteFamily(@Param('familyId') familyId: string): Promise<void> {
    await this.familiesService.deleteFamily(familyId);
  }

  @Get(':familyId/children/:childId')
  getChild(
    @Param('familyId') familyId: string,
    @Param('childId') childId: string,
  ): Promise<Child> {
    return this.familiesService.getChild(familyId, childId);
  }
}
