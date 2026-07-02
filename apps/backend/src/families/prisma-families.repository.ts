import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  deriveAgeBandOrNearest,
  type Child,
  type ConsentFlags,
  type ConsentScope,
  type Family,
  type GenderOption,
} from '@earlysteps/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateChildInput,
  CreateFamilyInput,
  FamiliesRepository,
} from './families.repository.js';

function toFamily(row: {
  id: string;
  locale: string;
  lowBandwidthMode: boolean;
  consentFlags: Prisma.JsonValue;
}): Family {
  return {
    id: row.id,
    locale: row.locale,
    low_bandwidth_mode: row.lowBandwidthMode,
    consent_flags: row.consentFlags as unknown as ConsentFlags,
  };
}

function toChild(row: {
  id: string;
  familyId: string;
  nickname: string;
  birthMonth: number;
  birthYear: number;
  gender: string | null;
  genderDetail: string | null;
  languages: string[];
}): Child {
  return {
    id: row.id,
    family_id: row.familyId,
    nickname: row.nickname,
    birth_month: row.birthMonth,
    birth_year: row.birthYear,
    // Derived at READ time so it can never go stale — a child ages into the next band
    // between sessions and every consumer (questionnaire included) just sees it (#25).
    // Nearest-band clamping keeps the app working for a child who ages past 25.
    age_band: deriveAgeBandOrNearest(row.birthMonth, row.birthYear),
    ...(row.gender ? { gender: row.gender as GenderOption } : {}),
    ...(row.genderDetail ? { gender_detail: row.genderDetail } : {}),
    languages: row.languages,
  };
}

@Injectable()
export class PrismaFamiliesRepository implements FamiliesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createFamily(input: CreateFamilyInput): Promise<Family> {
    const row = await this.prisma.family.create({
      data: {
        locale: input.locale,
        lowBandwidthMode: input.lowBandwidthMode ?? false,
        consentFlags: {},
      },
    });
    return toFamily(row);
  }

  async getFamily(familyId: string): Promise<Family | null> {
    const row = await this.prisma.family.findUnique({ where: { id: familyId } });
    return row ? toFamily(row) : null;
  }

  async updateConsent(
    familyId: string,
    scope: ConsentScope,
    granted: boolean,
  ): Promise<Family> {
    const existing = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!existing) {
      throw new NotFoundException(`No family found with id ${familyId}`);
    }
    const consentFlags = { ...(existing.consentFlags as ConsentFlags), [scope]: granted };
    const row = await this.prisma.family.update({
      where: { id: familyId },
      data: { consentFlags: consentFlags as unknown as Prisma.InputJsonValue },
    });
    return toFamily(row);
  }

  async createChild(familyId: string, input: CreateChildInput): Promise<Child> {
    const row = await this.prisma.child.create({
      data: {
        familyId,
        nickname: input.nickname,
        birthMonth: input.birthMonth,
        birthYear: input.birthYear,
        gender: input.gender ?? null,
        genderDetail: input.genderDetail ?? null,
        languages: input.languages,
      },
    });
    return toChild(row);
  }

  async getChild(childId: string): Promise<Child | null> {
    const row = await this.prisma.child.findUnique({ where: { id: childId } });
    return row ? toChild(row) : null;
  }

  async hasConsent(childId: string, scope: ConsentScope): Promise<boolean> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: { family: true },
    });
    if (!child) return false; // fail-safe: unknown child has no consent
    const flags = child.family.consentFlags as ConsentFlags;
    return flags[scope] === true;
  }
}
