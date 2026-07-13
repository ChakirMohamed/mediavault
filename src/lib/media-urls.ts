/** Extracts unique http(s) URLs from free text (multi-line paste, comma or space separated). */
export const parseUrls = (text: string): string[] => {
  const tokens = text
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const urls: string[] = [];

  for (const token of tokens) {
    try {
      const parsed = new URL(token);

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        urls.push(token);
      }
    } catch {
      // not a URL, skip
    }
  }

  return [...new Set(urls)];
};

const isYoutubeHost = (host: string) => host === "youtube.com" || host.endsWith(".youtube.com");

/** True when the URL points at a playlist/channel rather than a single video. */
export const isCollectionUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^(www|m)\./, "");

    if (isYoutubeHost(host)) {
      if (parsed.searchParams.has("list")) {
        return true;
      }

      return /^\/(playlist|channel\/|c\/|user\/|@)/.test(parsed.pathname);
    }

    if (host === "youtu.be") {
      return parsed.searchParams.has("list");
    }

    return /\/(playlist|playlists|sets|album)(\/|$)/.test(parsed.pathname);
  } catch {
    return false;
  }
};

/** Points YouTube channel roots at their Videos tab so yt-dlp lists videos directly. */
export const normalizeCollectionUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^(www|m)\./, "");

    if (!isYoutubeHost(host)) {
      return url;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const isChannelRoot =
      (segments.length === 1 && segments[0].startsWith("@")) ||
      (segments.length === 2 && ["channel", "c", "user"].includes(segments[0]));

    if (isChannelRoot) {
      parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/videos`;
      return parsed.toString();
    }

    return url;
  } catch {
    return url;
  }
};

export const formatDuration = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }

  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
};
