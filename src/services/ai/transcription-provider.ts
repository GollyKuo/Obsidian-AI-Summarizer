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

function parseTimeToMs(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return 0;
  }

  const colonParts = normalized.split(":").map((part) => Number(part.trim()));
  if (colonParts.length > 1 && colonParts.every((part) => Number.isFinite(part))) {
    const [hours = 0, minutes = 0, seconds = 0] =
      colonParts.length === 3 ? colonParts : [0, colonParts[0] ?? 0, colonParts[1] ?? 0];
    return Math.max(0, Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000));
  }

  let totalMs = 0;
  const hours = normalized.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutes = normalized.match(/(\d+(?:\.\d+)?)\s*m(?!s)/);
  const seconds = normalized.match(/(\d+(?:\.\d+)?)\s*s/);
  const milliseconds = normalized.match(/(\d+(?:\.\d+)?)\s*ms/);
  if (hours) {
    totalMs += Number(hours[1]) * 3_600_000;
  }
  if (minutes) {
    totalMs += Number(minutes[1]) * 60_000;
  }
  if (seconds) {
    totalMs += Number(seconds[1]) * 1_000;
  }
  if (milliseconds) {
    totalMs += Number(milliseconds[1]);
  }

  if (totalMs > 0) {
    return Math.max(0, Math.round(totalMs));
  }

  const numeric = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function parseTimingRange(value: string, fallbackIndex: number): { startMs: number; endMs: number } {
  const [rawStart = "", rawEnd = ""] = value.split(/\s*-\s*/, 2);
  const startMs = parseTimeToMs(rawStart);
  const parsedEndMs = parseTimeToMs(rawEnd);
  const fallbackEndMs = startMs > 0 ? startMs + 1000 : (fallbackIndex + 1) * 1000;
  return {
    startMs,
    endMs: parsedEndMs > startMs ? parsedEndMs : fallbackEndMs
  };
}

export function parseTranscriptMarkdownToSegments(
  transcriptMarkdown: string,
  options: { requireTiming?: boolean } = {}
): TranscriptSegment[] {
  return transcriptMarkdown
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("<!--"))
    .flatMap((line, index) => {
      const match = line.match(/^\{([^}]+)\}\s*(.*)$/);
      if (match) {
        const timing = parseTimingRange(match[1] ?? "", index);
        return [{
          ...timing,
          text: (match[2] ?? "").trim()
        }];
      }

      if (options.requireTiming) {
        return [];
      }

      return [{
        startMs: index * 1000,
        endMs: (index + 1) * 1000,
        text: line
      }];
    });
}
