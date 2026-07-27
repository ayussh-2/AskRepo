import { z } from 'zod';

const EXCLUDED_PATHS = [
  /^\/explore/,
  /^\/trending/,
  /^\/marketplace/,
  /^\/settings/,
  /^\/notifications/,
  /^\/login/,
  /^\/signup/,
  /^\/orgs/,
  /^\/issues$/,
  /^\/pulls$/,
];

export interface RepoInfo {
  valid: true;
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  subPath: string | null;
}

export interface InvalidRepo {
  valid: false;
  reason: string;
}

export type RepoDetectResult = RepoInfo | InvalidRepo;

function detectGithubRepo(rawUrl: string): RepoDetectResult {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'Invalid URL' };
  }

  const hostname = parsed.hostname.replace(/^www\./, '');

  if (hostname !== 'github.com') {
    return { valid: false, reason: 'Not a GitHub URL' };
  }

  const path = parsed.pathname.replace(/\.git$/, '');

  if (EXCLUDED_PATHS.some((rx) => rx.test(path))) {
    return { valid: false, reason: 'URL points to a GitHub page, not a repository' };
  }

  const match = path.match(/^\/([^/]+)\/([^/]+?)(\/.*)?$/);

  if (!match) {
    return { valid: false, reason: 'Could not parse a repository from this GitHub URL' };
  }

  const [, owner, repo, subPath] = match;

  return {
    valid: true,
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`,
    subPath: subPath || null,
  };
}

export const repoUrlSchema = z.string().transform((url, ctx) => {
  const result = detectGithubRepo(url);

  if (!result.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.reason,
    });
    return z.NEVER;
  }

  return result;
});

export function parseRepoUrl(url: string): RepoDetectResult {
  return detectGithubRepo(url);
}

export function isValidRepo(result: RepoDetectResult): result is RepoInfo {
  return result.valid === true;
}