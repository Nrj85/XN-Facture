'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { LOCALE_COOKIE, LOCALE_MAX_AGE, LOCALES, type Locale } from '@/lib/i18n/locale';

/**
 * Enregistre la langue de l'interface.
 *
 * **Aucune écriture en base.** C'est une préférence personnelle : deux
 * associés d'une même entreprise peuvent ne pas lire la même langue. Le cookie
 * suffit, et évite une migration pour un réglage qui ne concerne que
 * l'affichage.
 *
 * `revalidatePath('/', 'layout')` est indispensable : toute la coquille est
 * rendue côté serveur à partir de ce cookie. Sans invalidation, la page
 * resterait dans l'ancienne langue jusqu'au prochain rechargement complet.
 */
export async function setLocaleAction(locale: string): Promise<ActionResult<undefined>> {
  if (!LOCALES.includes(locale as Locale)) {
    return fail('Langue inconnue.');
  }

  cookies().set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    // Pas `httpOnly` : rien de sensible ici, et le laisser lisible permettra
    // un jour de deviner la langue au premier rendu côté client.
    httpOnly: false,
  });

  revalidatePath('/', 'layout');
  return ok();
}
