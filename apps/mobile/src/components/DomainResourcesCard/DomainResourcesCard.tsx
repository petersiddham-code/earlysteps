import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { resourcesForDomain } from '@earlysteps/content';
import { DOMAIN_DISPLAY_NAMES, type Domain } from '@earlysteps/shared-types';
import { colors, radius, spacing, type } from '../../theme/index.js';

export interface DomainResourcesCardProps {
  /** Domains with signs observed (the same set rendered as "Support needs"), not every domain. */
  domains: Domain[];
}

/**
 * Curated, trusted external links shown alongside support needs (issue #71) — one section per
 * domain with signs observed, each resource genuinely tappable (https via Linking), never bare
 * prose. Content comes from @earlysteps/content (clinical content, gated by
 * docs/clinical-review/), never hardcoded, same pattern as CrisisSupportCard's urgent_resources.
 * Renders nothing when there are no needs domains or none of them ship a resource yet.
 */
export function DomainResourcesCard({ domains }: DomainResourcesCardProps) {
  const sections = domains
    .map((domain) => ({ domain, resources: resourcesForDomain(domain) }))
    .filter((section) => section.resources.length > 0);
  if (sections.length === 0) return null;

  return (
    <View style={styles.card} testID="domain-resources-card">
      <Text style={styles.heading}>Learn more</Text>
      {sections.map(({ domain, resources }) => (
        <View key={domain} style={styles.section}>
          <Text style={styles.domainLabel}>{DOMAIN_DISPLAY_NAMES[domain]}</Text>
          {resources.map((resource) => (
            <Pressable
              key={resource.id}
              accessibilityRole="link"
              accessibilityLabel={resource.label}
              onPress={() => {
                // Fire-and-forget: if the device can't open the target there is nothing
                // useful to show the caregiver beyond the label/source already on screen.
                Linking.openURL(resource.value).catch(() => {});
              }}
              style={({ pressed }) => [
                styles.resource,
                pressed && styles.resourcePressed,
              ]}
              testID={`domain-resource-${resource.id}`}
            >
              <Text style={styles.resourceLabel}>{resource.label}</Text>
              {resource.description ? (
                <Text style={styles.resourceDescription}>{resource.description}</Text>
              ) : null}
              <Text style={styles.resourceSource}>{resource.source}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  heading: { ...type.bodyStrong, color: colors.ink },
  section: { gap: spacing.sm },
  domainLabel: { ...type.caption, color: colors.inkSoft, textTransform: 'uppercase' },
  resource: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  resourcePressed: {
    backgroundColor: colors.background,
  },
  resourceLabel: { ...type.bodyStrong, color: colors.primary },
  resourceDescription: {
    marginTop: 2,
    ...type.caption,
    color: colors.inkSoft,
  },
  resourceSource: {
    marginTop: spacing.xs,
    ...type.caption,
    color: colors.inkSoft,
    fontSize: 11,
  },
});
