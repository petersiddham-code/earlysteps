/**
 * EarlySteps design tokens — "morning mist" direction (issue #16 UI revamp).
 *
 * One quiet, calming system for the whole app: a green-tinted off-white ground, deep
 * spruce ink, the established teal as the only interactive colour, and a single warm
 * apricot accent reserved for progress/encouragement moments (never for results or
 * anything that could read as an alarm — result colours stay owned by TrafficLightBar).
 *
 * Screens must derive every colour/spacing/type decision from here rather than inlining
 * hex values, so the identity can't drift screen by screen.
 */

export const colors = {
  /** Screen background — green-tinted mist, softer than plain white on tired eyes. */
  background: '#F4F8F5',
  /** Elevated card surface. */
  card: '#FFFFFF',
  /** Primary text. */
  ink: '#24403B',
  /** Secondary text: hints, captions, explanations. */
  inkSoft: '#5C6F69',
  /** Interactive/brand teal (pre-revamp brand colour, kept). */
  primary: '#2E7D6B',
  /** Pressed/deep variant of primary. */
  primaryDeep: '#1F5A4D',
  /** Soft tint of primary for selected states and calm info surfaces. */
  primaryTint: '#E3F2F1',
  /** Warm apricot — progress + encouragement only. */
  accent: '#E8A05C',
  /** Soft tint of the accent for encouragement surfaces. */
  accentTint: '#FBF0E3',
  /** Hairline borders on cards/inputs. */
  border: '#D9E5DF',
  /** Disabled fills. */
  disabled: '#BFCEC9',
  /** Error text — calm terracotta, present but not shouting. */
  error: '#A6503B',
} as const;

/** 4pt-based spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

/**
 * Type scale. System font by design: custom font files add load time on the low-end,
 * low-bandwidth Android devices this app targets (CLAUDE.md §1) — personality comes from
 * scale, weight and spacing instead.
 */
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  /** Questionnaire question text — deliberately large for tired/low-literacy reading. */
  question: { fontSize: 21, lineHeight: 29, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** Small all-caps eyebrow labels. */
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.8 },
} as const;

/**
 * Soft card shadow — barely-there lift, not a hard material edge.
 *
 * boxShadow (not the legacy shadowColor/Offset/Opacity/Radius quartet): react-native-web
 * 0.21 deprecates the shadow* props and warns on every app load (#29), and React Native
 * itself renders boxShadow natively on Android/iOS since 0.76 (New Architecture), so one
 * cross-platform declaration replaces the old shadow* + elevation pair. Same visual:
 * 0 2 offset / 8 blur of #24403B at 6% opacity.
 */
export const cardShadow = {
  boxShadow: '0px 2px 8px rgba(36, 64, 59, 0.06)',
} as const;
