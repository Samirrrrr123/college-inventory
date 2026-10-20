import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../api/client';
import { accountPerson } from '../api/catalog';
import type { Account } from '../api/catalog';
import { Layout } from './Layout';
import { ApiFeedback } from '../features/catalog/ApiFeedback';

import { AccountContext } from './CurrentAccount';

export function LiveLayout() {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    api<{ data: Account }>('/me')
      .then((result) => {
        if (active) {
          setAccount(result.data);
          setError(null);
        }
      })
      .catch((failure: unknown) => {
        if (!active) return;
        if (failure instanceof ApiError && failure.status === 401)
          navigate('/login', { replace: true });
        else setError(failure);
      });
    return () => {
      active = false;
    };
  }, [attempt, navigate]);
  if (!account)
    return (
      <main className="live-loading">
        <ApiFeedback
          error={error}
          loading={!error}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      </main>
    );
  return (
    <AccountContext value={account}>
      <Layout livePerson={accountPerson(account)} />
    </AccountContext>
  );
}
