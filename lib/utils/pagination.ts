export interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

/** Loads every row explicitly; PostgREST projects commonly cap responses at 1,000 rows. */
export async function collectAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1_000,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
