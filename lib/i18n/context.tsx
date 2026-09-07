'use client';

import { createContext, useContext } from 'react';
import { dictionary, type Dictionary } from './dictionaries';
import type { Locale } from './locale';

/**
 * Langue et dictionnaire pour les composants clients.
 *
 * Le même parti que `CompanyProvider` : la valeur est résolue **une fois** par
 * la coquille serveur et distribuée par contexte. Faire descendre le
 * dictionnaire en props aurait traversé une trentaine de composants
 * présentationnels pour rien.
 *
 * Le contexte porte la LANGUE, pas le dictionnaire entier, et reconstruit
 * celui-ci côté client : sérialiser un objet contenant des fonctions à travers
 * la frontière serveur est impossible, et les pluriels sont des fonctions.
 */
const LocaleContext = createContext<Locale | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  const locale = useContext(LocaleContext);
  if (!locale) {
    throw new Error('useLocale doit être appelé sous un <LocaleProvider>.');
  }
  return locale;
}

/** Dictionnaire courant. `const t = useT()` puis `t.nav.dashboard`. */
export function useT(): Dictionary {
  return dictionary(useLocale());
}
