export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
  ConsentCenter: undefined;
  ChildProfileSetup: undefined;
  Questionnaire: undefined;
  /**
   * emptySubmit: the caregiver just finished the questionnaire having answered nothing
   * (every question skipped), so no computed results can exist yet. Results uses it to
   * render the honest "not enough information yet" state instead of its cold-resume
   * behaviour of routing straight back to the questionnaire — which read as a silent
   * session reset (#53).
   */
  Results: { emptySubmit?: boolean } | undefined;
};
