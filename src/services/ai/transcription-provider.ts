import type {
  MediaTranscriptionInput,
  MediaTranscriptionResult,
  TranscriptSegment
} from "@domain/types";

export interface TranscriptionProvider {
  transcribeMedia(
    input: MediaTranscriptionInput,
    signal: AbortSignal
  ): Promise<MediaTranscriptionResult>;
}

export function formatTranscriptMarkdown(transcript: TranscriptSegment[]): string {
  return transcript
    .map((segment) => `{${segment.startMs}-${segment.endMs}} ${segment.text}`)
    .join("\n");
}
