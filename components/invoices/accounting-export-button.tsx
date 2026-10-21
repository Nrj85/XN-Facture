'use client';

import Link from 'next/link';
import { Download, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePdfDownload } from '@/lib/pdf/use-pdf-download';
import { planByCode } from '@/lib/plans';

/**
 * Export comptable des factures de l'entreprise — formule Entreprise.
 *
 * ⚠️ **NE PAS CONFONDRE AVEC `admin/export-companies-button`.** Celui-là est
 * transversal, réservé aux administrateurs de plateforme, et sert la
 * prospection. Celui-ci porte les factures d'UNE entreprise, et c'est son
 * titulaire qui le télécharge pour son comptable.
 *
 * ⚠️ **Il réemploie `usePdfDownload`, qui n'a rien de spécifique au PDF** : le
 * crochet appelle une route, contrôle la réponse, remet un blob sous un nom de
 * fichier imposé, et rapporte l'erreur **du serveur**. En écrire un second
 * pour le CSV aurait dupliqué le garde-fou du corps vide et la gestion
 * d'erreur — un doublon est un bug. Seul son nom ment un peu ; c'est une dette
 * déjà consignée.
 *
 * ⚠️ **Passer par `fetch` plutôt qu'une ancre est délibéré.** Une balise
 * `<a download>` qui reçoit un 402 enregistre le message d'erreur JSON dans un
 * fichier `.csv` : on croit tenir son export et on n'ouvre la surprise que
 * dans son tableur.
 */
export function AccountingExportButton({ allowed }: { allowed: boolean }) {
  const { download, busy, error } = usePdfDownload();

  /*
    ⚠️ **HORS FORMULE, LE BOUTON EST REMPLACÉ PAR UN LIEN — il n'est ni grisé,
    ni masqué.**

    Grisé, ce serait un contrôle mort (§6.1). Masqué, cela cacherait
    l'existence d'une fonction qu'on VEND, et personne ne saurait quoi acheter.
    Le lien dit ce qui manque et mène là où on peut l'obtenir : « un refus qui
    n'ouvre aucun chemin est un cul-de-sac ». Même traitement que la carte du
    papier à en-tête.
  */
  if (!allowed) {
    return (
      <Link
        href="/abonnement"
        className="inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:border-line-strong hover:bg-sand hover:text-ink"
      >
        <Lock size={15} strokeWidth={2.2} className="text-ink-3" aria-hidden />
        Export comptable — formule {planByCode('business').name}
      </Link>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => {
          // Le nom définitif vient du serveur, qui date le fichier et y met le
          // nom de l'entreprise ; celui-ci n'est qu'un repli si l'en-tête se
          // perdait en route.
          void download('/api/comptabilite/export', 'xn-facture-comptabilite.csv');
        }}
      >
        {busy ? (
          <Loader2
            size={15}
            strokeWidth={2.2}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        ) : (
          <Download size={15} strokeWidth={2.2} aria-hidden />
        )}
        {busy ? 'Préparation…' : 'Export comptable (CSV)'}
      </Button>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-3 py-2 text-[12.5px] font-medium text-status-overdue"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
