export const pagesRouting = import.meta.env.VITE_GITHUB_PAGES === 'true'
export function publicUrl(path) {
  const base = new URL(import.meta.env.BASE_URL, location.origin)
  return pagesRouting ? base.href + '#' + path : new URL(path, base).href
}
