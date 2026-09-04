'use client';

import { createContext, useContext, useMemo } from 'react';
import { formatMoney as formatMoneyIn } from '@/lib/money';
import type { Company } from '@/lib/types';

/**
 * Contexte d'entreprise — **en lecture seule**.
 *
 * Il remplace la partie « lecture » de l'ancien store, et rien de plus : aucune
 * mutation ne passe par ici, les écritures sont des Server Actions importées
 * directement par les composants.
 *
 * Pourquoi un contexte plutôt que des props ? Parce que `formatMoney` est lié à
 * la devise de l'entreprise et sert dans huit composants purement
 * présentationnels — `totals-summary`, `invoice-preview`, `receivables-panel`,
 * `recent-invoices`… Les traverser en props reviendrait à faire descendre
 * l'entreprise entière à travers toute l'application pour formater un nombre.
 *
 * Les données métier, elles, ne sont PAS ici : factures, devis et clients
 * arrivent en props depuis les Server Components, ce qui évite de les charger
 * deux fois.
 */
interface CompanyContextValue {
  company: Company;
  /** `formatMoney` déjà lié à la devise : changer de devise se répercute partout. */
  formatMoney: (amount: number) => string;
  user: { displayName: string; email: string; initials: string };
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

/** Initiales calculées depuis le nom affiché, pour la pastille d'avatar. */
function initialsOf(name: string): string {
  const parts = name
    .split(/[\s@.-]+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return '??';
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '??';
}

export function CompanyProvider({
  company,
  user,
  children,
}: {
  company: Company;
  user: { displayName: string; email: string };
  children: React.ReactNode;
}) {
  const value = useMemo<CompanyContextValue>(
    () => ({
      company,
      formatMoney: (amount: number) => formatMoneyIn(amount, company.currency),
      user: { ...user, initials: initialsOf(user.displayName) },
    }),
    [company, user],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextValue {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany doit être utilisé à l’intérieur de <CompanyProvider>.');
  }
  return context;
}
