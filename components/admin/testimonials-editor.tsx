'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Eye, EyeOff, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/dialog';
import { initials, type Testimonial } from '@/lib/testimonials';
import {
  createTestimonial,
  deleteTestimonial,
  setTestimonialPublished,
  updateTestimonial,
} from '@/lib/actions/testimonials';

const MAX_QUOTE = 400;

type Brouillon = {
  quote: string;
  authorName: string;
  authorRole: string;
  position: number;
  published: boolean;
};

const vide = (position: number): Brouillon => ({
  quote: '',
  authorName: '',
  authorRole: '',
  position,
  published: false,
});

const depuis = (t: Testimonial): Brouillon => ({
  quote: t.quote,
  authorName: t.authorName,
  authorRole: t.authorRole,
  position: t.position,
  published: t.published,
});

/**
 * Éditeur des témoignages.
 *
 * ⚠️ **« PUBLIÉ » EST SÉPARÉ DE « ENREGISTRER », et c'est la décision
 * d'ergonomie centrale de cet écran.** Publier est le seul geste qui change ce
 * que voit le public, et c'est le plus fréquent — on écrit un témoignage une
 * fois, on le publie et on le retire souvent. Le noyer dans un formulaire de
 * trois champs obligerait à tout renvoyer pour basculer un booléen, et
 * risquerait d'écraser une saisie en cours.
 *
 * ⚠️ **LE COMPTEUR DE CARACTÈRES N'EST PAS DÉCORATIF.** La grille de la page
 * d'accueil est réglée au pixel : un texte trop long ne la rend pas « moins
 * jolie », il la casse. La base refuse au-delà de 400 (migration 0016) ; le
 * compteur évite d'écrire 600 caractères pour se les faire refuser à
 * l'enregistrement.
 *
 * ⚠️ **AUCUN ÉTAT N'EST DEVINÉ APRÈS UNE ÉCRITURE** : `router.refresh()` fait
 * relire la liste au serveur. Mettre à jour l'état local « comme si » ferait
 * diverger l'écran de la base au premier refus silencieux.
 */
export function TestimonialsEditor({ initial }: { initial: Testimonial[] }) {
  const router = useRouter();
  const [enCours, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [edite, setEdite] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [aSupprimer, setASupprimer] = useState<Testimonial | null>(null);

  const publies = initial.filter((t) => t.published).length;

  function apres(resultat: { ok: boolean; error?: string }, message: string) {
    if (!resultat.ok) {
      setErreur(resultat.error ?? 'L’opération n’a pas abouti.');
      return false;
    }
    setErreur(null);
    setSucces(message);
    setEdite(null);
    setBrouillon(null);
    router.refresh();
    return true;
  }

  function enregistrer() {
    if (!brouillon) return;
    setErreur(null);
    setSucces(null);
    start(async () => {
      const resultat =
        edite === 'nouveau'
          ? await createTestimonial(brouillon)
          : await updateTestimonial(edite!, brouillon);
      apres(resultat, edite === 'nouveau' ? 'Témoignage ajouté.' : 'Témoignage enregistré.');
    });
  }

  function basculer(t: Testimonial) {
    setErreur(null);
    setSucces(null);
    start(async () => {
      const resultat = await setTestimonialPublished(t.id, !t.published);
      apres(resultat, t.published ? 'Retiré de la page d’accueil.' : 'Publié sur la page d’accueil.');
    });
  }

  function supprimer() {
    if (!aSupprimer) return;
    const cible = aSupprimer;
    setASupprimer(null);
    setErreur(null);
    setSucces(null);
    start(async () => {
      apres(await deleteTestimonial(cible.id), 'Témoignage supprimé.');
    });
  }

  return (
    <div className="space-y-4">
      {/* État d'ensemble : c'est l'information qu'on vient chercher en arrivant. */}
      <Card className="p-4 sm:p-5">
        <p className="text-sm text-ink-2">
          {publies === 0 ? (
            <>
              <strong className="font-semibold text-ink">Aucun témoignage publié.</strong> La
              section n’apparaît pas du tout sur la page d’accueil — ni le titre, ni le bloc. Elle
              réapparaîtra dès le premier témoignage publié.
            </>
          ) : (
            <>
              <strong className="font-semibold text-ink">
                {publies} témoignage{publies > 1 ? 's' : ''} publié{publies > 1 ? 's' : ''}
              </strong>{' '}
              sur la page d’accueil, sur {initial.length} enregistré{initial.length > 1 ? 's' : ''}.
            </>
          )}
        </p>
      </Card>

      {erreur && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-4 py-2.5 text-[13px] font-medium text-status-overdue"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
          {erreur}
        </p>
      )}
      {succes && (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-status-paid">
          <Check className="h-4 w-4" aria-hidden />
          {succes}
        </p>
      )}

      {initial.map((t) =>
        edite === t.id && brouillon ? (
          <Formulaire
            key={t.id}
            brouillon={brouillon}
            setBrouillon={setBrouillon}
            onEnregistrer={enregistrer}
            onAnnuler={() => {
              setEdite(null);
              setBrouillon(null);
              setErreur(null);
            }}
            enCours={enCours}
          />
        ) : (
          <Card key={t.id} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span
                className={
                  t.published
                    ? 'inline-flex items-center gap-1.5 rounded-full bg-status-paid-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-status-paid'
                    : 'inline-flex items-center gap-1.5 rounded-full bg-status-draft-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-status-draft'
                }
              >
                <span
                  className={
                    t.published
                      ? 'h-1.5 w-1.5 rounded-full bg-status-paid-dot'
                      : 'h-1.5 w-1.5 rounded-full bg-status-draft-dot'
                  }
                  aria-hidden
                />
                {t.published ? 'En ligne' : 'Brouillon'}
              </span>
              <span className="text-[11.5px] text-ink-3">Rang {t.position}</span>
            </div>

            <blockquote className="mt-3 text-sm leading-relaxed text-ink">« {t.quote} »</blockquote>

            <div className="mt-3 flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-[12.5px] font-bold text-brand-hover"
                aria-hidden
              >
                {initials(t.authorName)}
              </span>
              <span>
                <p className="text-[13px] font-semibold text-ink">{t.authorName}</p>
                <p className="text-[12.5px] text-ink-2">{t.authorRole}</p>
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button type="button" onClick={() => basculer(t)} disabled={enCours}>
                {t.published ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
                {t.published ? 'Retirer de la page' : 'Publier'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={enCours}
                onClick={() => {
                  setEdite(t.id);
                  setBrouillon(depuis(t));
                  setErreur(null);
                  setSucces(null);
                }}
              >
                Modifier
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={enCours}
                onClick={() => setASupprimer(t)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Supprimer
              </Button>
            </div>
          </Card>
        ),
      )}

      {edite === 'nouveau' && brouillon ? (
        <Formulaire
          brouillon={brouillon}
          setBrouillon={setBrouillon}
          onEnregistrer={enregistrer}
          onAnnuler={() => {
            setEdite(null);
            setBrouillon(null);
            setErreur(null);
          }}
          enCours={enCours}
        />
      ) : (
        <Button
          type="button"
          disabled={enCours}
          onClick={() => {
            setEdite('nouveau');
            setBrouillon(vide(initial.length + 1));
            setErreur(null);
            setSucces(null);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter un témoignage
        </Button>
      )}

      <ConfirmDialog
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        onConfirm={supprimer}
        title="Supprimer ce témoignage ?"
        description="Il disparaîtra définitivement. Pour le retirer de la page d’accueil sans le perdre, utilisez « Retirer de la page »."
        confirmLabel="Supprimer"
      />
    </div>
  );
}

function Formulaire({
  brouillon,
  setBrouillon,
  onEnregistrer,
  onAnnuler,
  enCours,
}: {
  brouillon: Brouillon;
  setBrouillon: (b: Brouillon) => void;
  onEnregistrer: () => void;
  onAnnuler: () => void;
  enCours: boolean;
}) {
  const reste = MAX_QUOTE - brouillon.quote.length;

  return (
    <Card className="p-4 sm:p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onEnregistrer();
        }}
        className="space-y-4"
      >
        <Field
          label="Témoignage"
          hint={
            reste < 0
              ? `${-reste} caractère${reste < -1 ? 's' : ''} de trop — la grille de la page d’accueil ne tiendrait plus.`
              : `${reste} caractère${reste > 1 ? 's' : ''} restant${reste > 1 ? 's' : ''}.`
          }
          error={reste < 0 ? ' ' : undefined}
        >
          {(props) => (
            <textarea
              {...props}
              value={brouillon.quote}
              onChange={(e) => setBrouillon({ ...brouillon, quote: e.target.value })}
              rows={4}
              placeholder="Ce que cette personne dit du produit, dans ses mots."
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 hover:border-line-strong focus-visible:border-brand-bright"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom affiché" hint="Les initiales de l’avatar en sont déduites.">
            {(props) => (
              <Input
                {...props}
                value={brouillon.authorName}
                onChange={(e) => setBrouillon({ ...brouillon, authorName: e.target.value })}
                placeholder="Awa Nkolo"
                maxLength={60}
              />
            )}
          </Field>

          <Field label="Activité et ville" hint="Par exemple : Atelier de menuiserie — Yaoundé.">
            {(props) => (
              <Input
                {...props}
                value={brouillon.authorRole}
                onChange={(e) => setBrouillon({ ...brouillon, authorRole: e.target.value })}
                placeholder="Atelier de menuiserie — Yaoundé"
                maxLength={80}
              />
            )}
          </Field>
        </div>

        <Field label="Rang d’affichage" hint="Le plus petit apparaît en premier.">
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={String(brouillon.position)}
              onChange={(e) =>
                setBrouillon({ ...brouillon, position: Number(e.target.value) || 0 })
              }
              className="tabular max-w-[7rem]"
            />
          )}
        </Field>

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button type="submit" disabled={enCours || reste < 0}>
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Enregistrer
          </Button>
          <Button type="button" variant="secondary" disabled={enCours} onClick={onAnnuler}>
            Annuler
          </Button>
        </div>

        {/* ⚠️ On n'ajoute PAS d'interrupteur « publier » ici : la publication se
            fait depuis la carte, une fois le texte relu. Mêler les deux ferait
            mettre en ligne d'un même geste un texte qu'on vient d'écrire. */}
        <p className="text-[11.5px] leading-relaxed text-ink-3">
          L’enregistrement ne met pas en ligne. Relisez, puis utilisez « Publier » sur la carte.
        </p>
      </form>
    </Card>
  );
}
