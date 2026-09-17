'use client';

import { useState } from 'react';
import { CalendarOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { setRenewalIntentAction } from '@/lib/actions/subscription';
import { formatDate } from '@/lib/format';

/**
 * Déclarer que l'on ne renouvellera pas son abonnement.
 *
 * ⚠️ **Le mot « résilier » est évité, parce qu'il serait faux.** Rien n'est
 * interrompu : le mobile money ne sait pas prélever, il n'existe donc aucun
 * débit récurrent à couper. Écrire « Résilier mon abonnement » laisserait
 * croire à un arrêt immédiat, et l'accès qui continue jusqu'à l'échéance
 * passerait pour un dysfonctionnement — ou, pire, pour un prélèvement qui n'a
 * pas été arrêté.
 *
 * ⚠️ **Le bouton n'est PAS `danger`, et il n'est pas mis en avant.** Ce n'est
 * pas une destruction : rien n'est perdu, et la décision se défait d'un clic.
 * Un bouton rouge dramatiserait un geste réversible.
 *
 * ⚠️ **Il n'apparaît que sur une formule payante avec échéance.** Sur
 * Découverte il n'y aurait rien à ne pas renouveler — et la base refuse
 * l'appel, en français.
 */
export function RenewalIntent({
  expiresAt,
  planName,
  declined,
}: {
  expiresAt: string;
  planName: string;
  declined: boolean;
}) {
  const [confirme, setConfirme] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const appliquer = async (renew: boolean) => {
    setBusy(true);
    setErreur(null);
    try {
      const res = await setRenewalIntentAction(renew);
      if (!res.ok) setErreur(res.error);
    } catch {
      setErreur('La demande n’a pas abouti. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  };

  if (declined) {
    return (
      <div className="space-y-2.5 rounded-[10px] border border-line bg-sand px-4 py-3">
        <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-2">
          <CalendarOff className="mt-px h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <span>
            <strong className="font-semibold text-ink">
              Votre formule {planName} ne sera pas renouvelée.
            </strong>{' '}
            Elle reste entièrement active jusqu’au{' '}
            <span className="tabular font-semibold text-ink">{formatDate(expiresAt)}</span> — ce
            qui est payé vous reste dû. Ce jour-là, votre compte revient à la formule Découverte :
            vos factures, vos devis et vos clients restent consultables et exportables, seule
            l’émission repasse à cinq factures par mois.
          </span>
        </p>

        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void appliquer(true)}>
          <RotateCcw size={15} strokeWidth={2.2} aria-hidden />
          {busy ? 'Enregistrement…' : 'Finalement, je renouvelle'}
        </Button>

        {erreur && (
          <p role="alert" className="text-[12.5px] font-medium text-status-overdue">
            {erreur}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirme(true)}>
        Je ne souhaite pas renouveler
      </Button>

      {erreur && (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-status-overdue">
          {erreur}
        </p>
      )}

      <ConfirmDialog
        open={confirme}
        onClose={() => setConfirme(false)}
        onConfirm={() => void appliquer(false)}
        title="Ne pas renouveler cette formule"
        description={`Votre formule ${planName} restera active jusqu’au ${formatDate(expiresAt)} : vous ne perdez rien de ce que vous avez payé. Nous cesserons simplement de vous rappeler l’échéance, et votre compte reviendra à la formule Découverte ce jour-là. Vous pourrez revenir sur cette décision à tout moment.`}
        confirmLabel="Ne pas renouveler"
      />
    </div>
  );
}
