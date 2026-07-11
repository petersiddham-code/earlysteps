export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
  ConsentCenter: undefined;
  ChildProfileSetup: undefined;
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
};
