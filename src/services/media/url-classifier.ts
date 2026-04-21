import { SummarizerError } from "@domain/errors";

export type MediaUrlSourceType = "youtube" | "podcast" | "direct_media";

export interface MediaUrlClassification {
  normalizedUrl: string;
  sourceType: MediaUrlSourceType;
  host: string;
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

const PODCAST_HOST_HINTS = [
  "podcast",
  "podcasts.apple.com",
  "open.spotify.com",
  "soundcloud.com",
  "overcast.fm",
  "castbox.fm",
  "anchor.fm"
];

const DIRECT_MEDIA_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".wav",
  ".flac",
  ".ogg",
  ".aac",
  ".mp4",
  ".m4v",
  ".mov",
  ".webm",
  ".mkv"
];

function parseHttpUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Media URL is empty.",
      recoverable: true
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SummarizerError({
      category: "validation_error",
      message: `Invalid media URL: ${trimmed}`,
      recoverable: true
    });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SummarizerError({
      category: "validation_error",
      message: `Unsupported media URL protocol: ${parsed.protocol}`,
      recoverable: true
    });
  }

  return parsed;
}

function isYouTube(url: URL): boolean {
  return YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
}

function isDirectMedia(url: URL): boolean {
  const pathLower = url.pathname.toLowerCase();
  return DIRECT_MEDIA_EXTENSIONS.some((extension) => pathLower.endsWith(extension));
}

function isPodcast(url: URL): boolean {
  const hostLower = url.hostname.toLowerCase();
  const pathLower = url.pathname.toLowerCase();
  const queryLower = url.search.toLowerCase();

  if (pathLower.endsWith(".rss") || pathLower.endsWith(".xml")) {
    return true;
  }

  if (queryLower.includes("feed=") || queryLower.includes("podcast")) {
    return true;
  }

  if (pathLower.includes("/podcast") || pathLower.includes("/episode")) {
    return true;
  }

  return PODCAST_HOST_HINTS.some((hint) => hostLower.includes(hint));
}

export function classifyMediaUrl(rawUrl: string): MediaUrlClassification {
  const parsed = parseHttpUrl(rawUrl);

  let sourceType: MediaUrlSourceType | null = null;
  if (isYouTube(parsed)) {
    sourceType = "youtube";
  } else if (isDirectMedia(parsed)) {
    sourceType = "direct_media";
  } else if (isPodcast(parsed)) {
    sourceType = "podcast";
  }

  if (!sourceType) {
    throw new SummarizerError({
      category: "validation_error",
      message: `Unsupported media URL source: ${parsed.toString()}`,
      recoverable: true
    });
  }

  return {
    normalizedUrl: parsed.toString(),
    sourceType,
    host: parsed.hostname.toLowerCase()
  };
}
