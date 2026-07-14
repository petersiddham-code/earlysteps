export type RootStackParamList = {
  Splash: undefined;
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
   * Issue #125, Admin Console v1: read-only ops dashboard (accounts, tier distribution).
   * Reached only via <AdminConsoleButton/> on ChildSwitcherScreen, which renders nothing
   * unless isAdmin(session) is true — never reachable by a parent/guest session.
   */
  AdminDashboard: undefined;
  /** Read-only question bank / red-flag copy summary — no editing in this phase. */
  AdminContent: undefined;
  /** Read-only rendering of docs/clinical-review/README.md's sign-off log. */
  AdminReviewLog: undefined;
};
