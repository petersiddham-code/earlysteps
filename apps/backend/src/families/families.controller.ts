import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import type { Child, Family } from '@earlysteps/shared-types';
import { FamiliesService } from './families.service.js';
import { CreateFamilyDto } from './dto/create-family.dto.js';
import { CreateChildDto } from './dto/create-child.dto.js';
import { UpdateConsentDto } from './dto/update-consent.dto.js';

@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Post()
  createFamily(@Body() dto: CreateFamilyDto): Promise<Family> {
    return this.familiesService.createFamily({
      locale: dto.locale,
      lowBandwidthMode: dto.low_bandwidth_mode,
    });
  }

  @Get(':familyId')
  getFamily(@Param('familyId') familyId: string): Promise<Family> {
    return this.familiesService.getFamily(familyId);
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
      ageBand: dto.age_band,
      languages: dto.languages,
    });
  }

  @Get(':familyId/children/:childId')
  getChild(
    @Param('familyId') familyId: string,
    @Param('childId') childId: string,
  ): Promise<Child> {
    return this.familiesService.getChild(familyId, childId);
  }
}
