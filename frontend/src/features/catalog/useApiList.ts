import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../../api/client';
import type { ListResult } from '../../api/catalog';

export function useApiList<T>(path: string, revision: number) {
  const key = `${revision}:${path}`;
  const [state, setState] = useState<{
    key: string;
    result: ListResult<T> | null;
    error: unknown;
  } | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    api<ListResult<T>>(path)
      .then((value) => {
        if (active) setState({ key, result: value, error: null });
      })
      .catch((failure: unknown) => {
        if (!active) return;
        if (failure instanceof ApiError && failure.status === 401)
          navigate('/login', { replace: true });
        else setState({ key, result: null, error: failure });
      });
    return () => {
      active = false;
    };
  }, [path, key, navigate]);
  const loading = state?.key !== key;
  return { result: loading ? null : state.result, error: loading ? null : state.error, loading };
}
