import { createContext, useContext } from 'react';
import type { Account } from '../api/catalog';

export const AccountContext = createContext<Account | null>(null);

export function useCurrentAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error('Current account is unavailable');
  return account;
}
