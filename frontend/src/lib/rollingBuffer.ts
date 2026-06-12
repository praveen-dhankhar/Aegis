export function appendBounded<T>(items: T[], item: T, max = 60): T[] {
  return [...items, item].slice(-max)
}
