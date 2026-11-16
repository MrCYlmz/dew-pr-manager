export function previewSpecMatch(pr, rule) {
  if (rule.useRepoSuffix) {
    const repo = pr.repoName.toLowerCase();
    if (rule.repoSuffixes.some((sfx) => repo.endsWith(sfx))) return true;
  }
  if (rule.useFileKeywords && rule.fileKeywords.length > 0) {
    return pr.changedFilePaths.some((path) => {
      const lower = path.toLowerCase();
      return rule.fileKeywords.some((kw) => lower.includes(kw));
    });
  }
  return false;
}

export function splitWords(text) {
  return [...new Set(text.split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean))];
}

export function sameSettings(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
