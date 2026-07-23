/**
 * Port for the independent AI results-summary call (issue #104).
 *
 * The client receives only the raw questionnaire answers plus age band/gender — never the
 * deterministic engine's computed levels, estimate, recommendation, or red flags (CLAUDE.md
 * §2 rule 7). All interpretation happens in AnalysisService behind schema + content-safety
 * validation — the client cannot influence scoring in any way.
 */

/** One answered question, reduced to what the narrative prompt needs (PII minimization). */
export interface AiSummaryAnsweredQuestion {
  questionText: string;
  /** Caregiver-facing option label(s) selected, already resolved from ids. */
  selectedLabels: string[];
  /** The caregiver's own typed note, if any (free_text: prefix already stripped). */
  freeText?: string;
}

/**
 * One decrypted photo, ready to attach as image content (issue #135, Phase 2). The client
 * never writes this to disk or logs — it exists only for the duration of one generation call.
 */
export interface AiSummaryPhotoEvidence {
  mimeType: string;
  base64Data: string;
}

/**
 * One still frame sampled from a stored video (issue #139, Phase 3) — already extracted and
 * decrypted by the caller. Shape mirrors AiSummaryPhotoEvidence exactly (both become image
 * content blocks); kept as a separate type so the two evidence sources can't be silently
 * conflated, and so `<media_evidence>` can state each count separately for the prompt's
 * still-frame-discipline rules. Same lifetime discipline: never written to disk/logs, exists
 * only for the duration of one generation call.
 */
export interface AiSummaryVideoFrameEvidence {
  mimeType: string;
  base64Data: string;
}

/**
 * One speech-to-text transcript of a caregiver-captured audio clip (issue #140, Phase 4).
 * Unlike photos/video frames this is plain text, not an image content block — attached as
 * part of the text message, tagged separately as `<audio_evidence>` so the model treats it
 * as a machine transcript of recorded speech, never as something the caregiver typed
 * (never folded into `answers`' freeText) and never as more reliable than a transcript
 * actually is.
 */
export interface AiSummaryAudioTranscriptEvidence {
  transcript: string;
}

export interface AiResultsSummaryInput {
  ageBand: string;
  gender?: string;
  answers: AiSummaryAnsweredQuestion[];
  /** Caregiver-captured photo evidence, already consent-gated by the caller. May be empty. */
  photos: AiSummaryPhotoEvidence[];
  /**
   * Still frames sampled from caregiver-captured videos, already consent-gated and
   * frame-extracted by the caller. May be empty. Ordering matters: the client attaches
   * these image blocks after `photos`, and the `<media_evidence>` tag states both counts in
   * that same order so the model can map "first `photos.length` images are photos, next
   * `videoFrames.length` are video-derived frames" positionally.
   */
  videoFrames: AiSummaryVideoFrameEvidence[];
  /**
   * Speech-to-text transcripts of caregiver-captured audio clips, already consent-gated
   * and transcribed by the caller. May be empty.
   */
  audioTranscripts: AiSummaryAudioTranscriptEvidence[];
}

export interface AiResultsSummaryClient {
  /**
   * Returns the model's raw text output, or null when generation is unavailable (no API
   * key configured, transport failure, ...). The stage always fails closed: whatever this
   * returns is schema- and content-safety-validated before anything is done with it.
   */
  generateSummary(input: AiResultsSummaryInput): Promise<string | null>;
}

export const AI_RESULTS_SUMMARY_CLIENT = Symbol('AI_RESULTS_SUMMARY_CLIENT');

/**
 * Wired when no ANTHROPIC_API_KEY is configured: the section silently never renders and
 * the deterministic Results screen is unaffected (offline-first, same as issue #26).
 */
export class DisabledAiResultsSummaryClient implements AiResultsSummaryClient {
  async generateSummary(): Promise<null> {
    return null;
  }
}
