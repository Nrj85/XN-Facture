'use client';

import { useState } from 'react';
import { CheckCircle2, MailX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setMarketingPreferenceAction } from '@/lib/actions/email-preferences';

type Etat = 'attente' | 'desabonne' | 'reabonne';

/**
 * Confirmation du désabonnement.
 *
 * ⚠️ **RIEN n'est enregistré à l'ouverture de la page, et c'est essentiel.**
 * Les passerelles antispam et les clients de messagerie **visitent les liens**
 * d'un message pour les inspecter avant de les montrer. Une page qui se
 * désabonnerait au chargement retirerait donc des gens qui n'ont jamais
 * cliqué — et qui continueraient d'attendre des messages qu'ils ne recevraient
 * plus. Le geste doit venir d'un bouton.
 *
 * ⚠️ **Le retour en arrière est offert dans la foulée.** Un désabonnement
 * déclenché par erreur, sur un téléphone, dans une liste de messages, doit se
 * défaire sur la même page : sinon la seule issue est d'écrire au support.
 */
export function UnsubscribeForm({ token }: { token: string }) {
  const [etat, setEtat] = useState<Etat>('attente');
  const [email, setEmail] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const appliquer = async (accepte: boolean) => {
    setBusy(true);
    setErreur(null);
    try {
      const res = await setMarketingPreferenceAction(token, accepte);

      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      setEmail(res.data.email);
      setEtat(accepte ? 'reabonne' : 'desabonne');
    } catch {
      // ⚠️ Sans ce filet, une panne réseau ou une erreur inattendue de la
      // Server Action laisse le bouton bloqué sur « Enregistrement… » et
      // n'affiche RIEN : l'utilisateur conclut que le désabonnement ne marche
      // pas, et clique sur « indésirable ». Constaté pendant les essais.
      setErreur('La demande n’a pas abouti. Vérifiez votre connexion et réessayez.');
    } finally {
      // Dans le `finally` : un `return` anticipé plus haut laisserait sinon le
      // bouton désactivé pour toujours.
      setBusy(false);
    }
  };

  if (etat !== 'attente') {
    const desabonne = etat === 'desabonne';
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2.5 text-[13px] text-ink-2" role="status">
          <CheckCircle2
            className="mt-px h-4 w-4 shrink-0 text-status-paid-dot"
            aria-hidden
          />
          <span>
            {desabonne ? (
              <>
                C’est enregistré. <strong className="font-semibold text-ink">{email}</strong> ne
                recevra plus nos messages d’information ni nos offres.
              </>
            ) : (
              <>
                C’est rétabli. <strong className="font-semibold text-ink">{email}</strong>{' '}
                recevra de nouveau nos messages d’information.
              </>
            )}
          </span>
        </p>

        {desabonne ? (
          <>
            {/* Dire ce qui CONTINUE d'arriver évite l'inquiétude — et évite
                surtout qu'on nous reproche un message d'échéance reçu après
                un désabonnement. */}
            <p className="rounded-[10px] border border-line bg-sand px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
              <strong className="font-semibold text-ink">
                Les messages liés à votre compte continuent d’arriver :
              </strong>{' '}
              confirmation d’adresse, réinitialisation de mot de passe, et avis avant l’échéance
              de votre abonnement. Nous ne pouvons pas vous laisser perdre votre formule sans
              vous prévenir.
            </p>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void appliquer(true)}>
              C’était une erreur, me réabonner
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void appliquer(false)}>
            Finalement, me désabonner
          </Button>
        )}

        {erreur && (
          <p role="alert" className="text-[12.5px] font-medium text-status-overdue">
            {erreur}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-ink-2">
        Confirmez pour ne plus recevoir nos messages d’information et nos offres. Les messages
        liés au fonctionnement de votre compte — mot de passe, confirmation d’adresse, avis
        d’échéance — continueront d’arriver.
      </p>

      <Button type="button" disabled={busy} onClick={() => void appliquer(false)}>
        <MailX size={15} strokeWidth={2.2} aria-hidden />
        {busy ? 'Enregistrement…' : 'Confirmer le désabonnement'}
      </Button>

      {erreur && (
        <p
          role="alert"
          className="rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-3 py-2 text-[12.5px] font-medium text-status-overdue"
        >
          {erreur}
        </p>
      )}
    </div>
  );
}
