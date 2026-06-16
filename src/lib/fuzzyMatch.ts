export type RouteMatchResult = 'exact' | 'similar' | 'different'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äÄ]/g, 'a')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[-\s_.,']/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function compareRoutes(r1: string, r2: string): RouteMatchResult {
  const n1 = normalize(r1)
  const n2 = normalize(r2)
  if (n1 === n2) return 'exact'
  const dist = levenshtein(n1, n2)
  const maxLen = Math.max(n1.length, n2.length)
  if (maxLen === 0) return 'exact'
  if (dist <= 3 || dist / maxLen <= 0.25) return 'similar'
  return 'different'
}
