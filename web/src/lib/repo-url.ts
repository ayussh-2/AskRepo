export function isValidRepoUrl(input: string): boolean {
  if (!input || !input.trim()) return false;
  const str = input.trim();
  const fullUrlPattern =
    /^(https?:\/\/)?(www\.)?(github\.com|gitlab\.com)\/[\w.-]+\/[\w.-]+\/?$/i;
  const shorthandPattern = /^[\w.-]+\/[\w.-]+$/;
  return fullUrlPattern.test(str) || shorthandPattern.test(str);
}

export function normalizeRepoUrl(input: string): string {
  let str = input.trim();
  if (str.endsWith(".git")) {
    str = str.slice(0, -4);
  }
  if (!str.startsWith("http://") && !str.startsWith("https://")) {
    if (str.startsWith("github.com/") || str.startsWith("gitlab.com/")) {
      return `https://${str}`;
    }
    return `https://github.com/${str}`;
  }
  return str;
}
