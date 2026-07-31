export async function vendureShopRequest<T>(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch('/api/shop/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `Shop API error: ${response.status}`)
  if (result.errors?.length) throw new Error(result.errors[0].message)
  return result.data as T
}
