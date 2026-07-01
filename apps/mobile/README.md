# @earlysteps/mobile (placeholder)

React Native + Expo app (product plan §5, §6). **Not implemented in the foundation phase.**

When scaffolded, this is where the safety-carrying shared components live —
`<ScreeningDisclaimer />`, `<TrafficLightBar />`, `<StrengthsFirstList />`,
`<RedFlagBanner />`, `<ConsentToggle />` (CLAUDE.md §6) — consuming `@earlysteps/content`
for copy and `@earlysteps/scoring-engine` for levels. It must never render a results/report
view without the disclaimer.
