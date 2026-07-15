import type {
  AdminAccountSummary,
  AdminEditableContentKey,
} from '@earlysteps/shared-types';

export type RootStackParamList = {
  /**
   * Issue #125: skipAdminChoice lets AdminLanding's "Continue to app" button replace
   * back to Splash and fall through its normal family/child routing below, without
   * bouncing back to AdminLanding a second time.
   */
  Splash: { skipAdminChoice?: boolean } | undefined;
  Login: undefined;
  Signup: undefined;
  ConsentCenter: undefined;
  ChildProfileSetup: undefined;
  /**
   * Issue #23: lists the logged-in family's children so a caregiver can switch which one
   * is active, or add another. Reached from Results ("Switch child") and from Splash when
   * a recovered family already has children but no local childId is selected yet — never
   * shown to a guest session (nothing is persisted server-side for one to list).
   */
  ChildSwitcher: undefined;
  Questionnaire: undefined;
  /**
   * Issue #102: interim step for a Premium submission that included free text — checks
   * for AI-detected confirmation follow-ups before Results ever renders, so a caregiver
   * never watches a result change under them after confirming one. Never reached by a
   * guest, free-tier, or no-free-text submission; those go straight to Results.
   */
  FollowUpCheck: undefined;
  /**
   * emptySubmit: the caregiver just finished the questionnaire having answered nothing
   * (every question skipped), so no computed results can exist yet. Results uses it to
   * render the honest "not enough information yet" state instead of its cold-resume
   * behaviour of routing straight back to the questionnaire — which read as a silent
   * session reset (#53).
   */
  Results: { emptySubmit?: boolean } | undefined;
  /**
   * Issue #125: shown on every app launch/resume where Splash resolves an admin session,
   * right after the login gate and before the normal family/child routing below — an
   * admin picks "Continue to app" (replaces back to Splash with skipAdminChoice) or
   * "Open admin console" (pushes AdminDashboard). Never shown to a parent/guest session.
   */
  AdminLanding: undefined;
  /**
   * Issue #125, Admin Console v1: read-only ops dashboard (accounts, tier distribution).
   * Reached from AdminLanding right after login, or via <AdminConsoleButton/> on
   * ChildSwitcherScreen as a secondary entry point once already in the app — never
   * reachable by a parent/guest session either way.
   */
  AdminDashboard: undefined;
  /**
   * Issue #131: direct (non-draft) editor for one account's username/tier/role. Takes the
   * whole summary rather than just an id — AdminDashboard already has it loaded, so this
   * avoids a redundant GET-by-id endpoint that doesn't otherwise exist.
   */
  AdminAccountEdit: { account: AdminAccountSummary };
  /** Question bank / red-flag copy summary, with entry points into draft editing (issue #127). */
  AdminContent: undefined;
  /**
   * Issue #127: field-level draft editor for one content key. Editing is draft-only — see
   * docs/clinical-review/2026-07-15-issue127-admin-content-editing-plan.md. Which fields
   * are draftable at all is decided server-side (admin-content-registry.ts), not here.
   */
  AdminContentEdit: { contentKey: AdminEditableContentKey };
  /** Issue #127: pending drafts, optionally scoped to one content key. Discard-only here. */
  AdminContentDrafts: { contentKey?: AdminEditableContentKey } | undefined;
  /** Read-only rendering of docs/clinical-review/README.md's sign-off log. */
  AdminReviewLog: undefined;
};
