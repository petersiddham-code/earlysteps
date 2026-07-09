import type { Domain } from '@earlysteps/shared-types';
import domainResources from '../domain-resources/domain-resources.json' with { type: 'json' };
import {
  domainResourcesFileSchema,
  type DomainResource,
  type DomainResourcesFile,
} from './schema.js';

export const DOMAIN_RESOURCES: DomainResourcesFile =
  domainResourcesFileSchema.parse(domainResources);

/** Curated external resources for one domain (issue #71) — empty if none are shipped yet. */
export function resourcesForDomain(domain: Domain): DomainResource[] {
  return DOMAIN_RESOURCES.resources.filter((r) => r.domain === domain);
}
