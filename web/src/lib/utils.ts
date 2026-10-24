export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export { BASE_URL } from "./constants";

export {
  parseJwtPayload,
  getUserName,
  getTokenExp,
  isTokenExpired,
  triggerSilentGoogleRefresh,
  getStoredToken,
  clearUserSession,
} from "./auth";

export { isValidRepoUrl, normalizeRepoUrl } from "./repo-url";

export { tokenizeCode, type CodeToken } from "./syntax-highlighter";
