import { useCallback, useEffect, useState } from 'react'

export function useAsync(load, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await load()) } catch (e) { setError(e) } finally { setLoading(false) }
  }, deps)

  useEffect(() => { refresh() }, [refresh])
  return { data, loading, error, refresh }
}
