'use client';

import { useRef, useState, useTransition } from 'react';
import { AlertCircle, Check, FileText, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { removeLetterheadAction, updateLetterheadAction } from '@/lib/actions/letterhead';
import type { LetterheadMode } from '@/lib/types';

const MAX_SOURCE_OCTETS = 8 * 1024 * 1024;
/** A4 à 150 ppp. Au-delà, le poids explose sans gain visible à l'impression. */
const LARGEUR_CIBLE = 1240;

/**
 * Redimensionne et ré-encode l'en-tête avant stockage.
 *
 * ⚠️ **TOUT REPASSE PAR UN CANVAS, et c'est aussi une protection.** Le but
 * premier est le poids : un scan d'en-tête fait couramment 4 Mo, qui seraient
 * relus à chaque PDF. Mais l'effet de bord compte autant — ce qui ressort du
 * canvas est **du PNG rasterisé**, donc un SVG déposé ici perd tout script en
 * chemin. La validation serveur l'exclut déjà ; ceci la double.
 *
 * ⚠️ **PNG d'abord, JPEG en repli si c'est trop lourd.** Un en-tête est un
 * aplat avec du texte fin : le JPEG le rendrait flou là où il doit rester net.
 * On n'y passe que si le PNG dépasse le plafond, auquel cas un en-tête un peu
 * adouci vaut mieux qu'un refus.
 */
function preparer(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Ce fichier n’est pas une image exploitable.'));
      image.onload = () => {
        const echelle = Math.min(1, LARGEUR_CIBLE / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * echelle);
        canvas.height = Math.round(image.height * echelle);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Redimensionnement impossible sur ce navigateur.'));
          return;
        }
        // Fond blanc : un PNG transparent ré-encodé en JPEG virerait au noir.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const png = canvas.toDataURL('image/png');
        resolve(png.length <= 2 * 1024 * 1024 ? png : canvas.toDataURL('image/jpeg', 0.9));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Papier à en-tête.
 *
 * Retour client : *« beaucoup d'entreprises ont leur propre papier à en-tête »*.
 * Deux situations réelles, et le même mécanisme derrière — le document s'efface
 * pour ne pas imprimer par-dessus ce que le papier porte déjà.
 *
 * ⚠️ **Carte à part des quatre sections d'entreprise.** Elle ne décrit pas
 * l'entreprise, elle change la FORME de chaque document émis. La fondre dans
 * « Identité » aurait mis un réglage d'impression à côté d'un nom commercial.
 */
export function LetterheadForm({
  mode: modeInitial,
  topMm: topInitial,
  bottomMm: bottomInitial,
  keepLegal: legalInitial,
  aDejaUneImage,
}: {
  mode: LetterheadMode;
  topMm: number;
  bottomMm: number;
  keepLegal: boolean;
  aDejaUneImage: boolean;
}) {
  const [mode, setMode] = useState<LetterheadMode>(modeInitial);
  const [topMm, setTopMm] = useState(topInitial);
  const [bottomMm, setBottomMm] = useState(bottomInitial);
  const [keepLegal, setKeepLegal] = useState(legalInitial);
  const [dataUrl, setDataUrl] = useState<string | undefined>(undefined);
  const [aImage, setAImage] = useState(aDejaUneImage);

  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, start] = useTransition();
  const champFichier = useRef<HTMLInputElement>(null);

  const actif = mode !== 'none';

  async function choisirFichier(file: File | undefined) {
    if (!file) return;
    setErreur(null);
    setSucces(null);
    if (!file.type.startsWith('image/')) {
      setErreur('Choisissez un fichier image (PNG ou JPG).');
      return;
    }
    if (file.size > MAX_SOURCE_OCTETS) {
      setErreur('Image trop lourde : 8 Mo au maximum.');
      return;
    }
    try {
      setDataUrl(await preparer(file));
      setAImage(true);
      setMode('image');
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : 'Import impossible.');
    } finally {
      if (champFichier.current) champFichier.current.value = '';
    }
  }

  function enregistrer() {
    setErreur(null);
    setSucces(null);
    start(async () => {
      const result = await updateLetterheadAction({
        mode,
        topMm,
        bottomMm,
        keepLegal,
        dataUrl,
        aDejaUneImage: aImage,
      });
      if (!result.ok) {
        setErreur(result.error);
        return;
      }
      setDataUrl(undefined);
      setSucces('Réglages enregistrés. Ils s’appliquent aux prochains documents générés.');
    });
  }

  function retirer() {
    setErreur(null);
    setSucces(null);
    start(async () => {
      const result = await removeLetterheadAction();
      if (!result.ok) {
        setErreur(result.error);
        return;
      }
      setAImage(false);
      setDataUrl(undefined);
      setMode('none');
      setSucces('En-tête retiré.');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Papier à en-tête</CardTitle>
      </CardHeader>

      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Si votre entreprise a son propre papier à en-tête, le document s’efface pour ne pas
          l’imprimer deux fois : plus de logo, plus de bloc « Émetteur ».
        </p>

        <fieldset className="space-y-2">
          <legend className="text-[12.5px] font-medium text-ink-2">Comment l’utilisez-vous ?</legend>
          {(
            [
              ['none', 'Aucun', 'Le document imprime son propre en-tête, comme aujourd’hui.'],
              [
                'preprinted',
                'J’imprime sur mon papier',
                'Rien à téléverser. Le document laisse le blanc nécessaire en haut et en bas.',
              ],
              [
                'image',
                'J’ai mon en-tête en fichier',
                'Il est dessiné sur chaque page — utile quand la facture part par email ou WhatsApp.',
              ],
            ] as const
          ).map(([valeur, titre, aide]) => (
            <label
              key={valeur}
              className={
                mode === valeur
                  ? 'flex cursor-pointer gap-3 rounded-[10px] border border-brand-bright bg-brand-soft p-3'
                  : 'flex cursor-pointer gap-3 rounded-[10px] border border-line bg-surface p-3 transition-colors duration-150 hover:border-line-strong'
              }
            >
              <input
                type="radio"
                name="letterhead-mode"
                value={valeur}
                checked={mode === valeur}
                onChange={() => {
                  setMode(valeur);
                  setErreur(null);
                  setSucces(null);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
              />
              <span>
                <span className="block text-[13px] font-semibold text-ink">{titre}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-2">{aide}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {/* ⚠️ Les réglages fins n'apparaissent QUE si un mode est actif : §6.1,
            pas de contrôle mort. Régler une marge qui ne s'applique nulle part
            n'apprendrait rien et ferait croire à un effet. */}
        {actif && (
          <>
            {mode === 'image' && (
              <div className="space-y-2 border-t border-line pt-4">
                <input
                  ref={champFichier}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => choisirFichier(e.target.files?.[0])}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={enCours}
                    onClick={() => champFichier.current?.click()}
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    {aImage ? 'Remplacer l’en-tête' : 'Téléverser mon en-tête'}
                  </Button>
                  {aImage && (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-status-paid">
                      <FileText className="h-4 w-4" aria-hidden />
                      En-tête enregistré
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] leading-relaxed text-ink-3">
                  L’image doit être la <strong className="font-semibold">page entière</strong> de
                  votre papier, en-tête et pied compris, au format A4. Elle est réduite à 1240 px de
                  large avant d’être enregistrée.
                </p>
                {aImage && (
                  <Button type="button" variant="ghost" disabled={enCours} onClick={retirer}>
                    Retirer l’en-tête
                  </Button>
                )}
              </div>
            )}

            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <Field
                label="Blanc réservé en haut"
                hint="En millimètres. Mesurez la hauteur de votre en-tête à la règle."
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    value={String(topMm)}
                    onChange={(e) => setTopMm(Math.min(120, Math.max(0, Number(e.target.value) || 0)))}
                    className="tabular max-w-[8rem]"
                  />
                )}
              </Field>
              <Field label="Blanc réservé en bas" hint="En millimètres, pour le pied de page.">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={80}
                    value={String(bottomMm)}
                    onChange={(e) => setBottomMm(Math.min(80, Math.max(0, Number(e.target.value) || 0)))}
                    className="tabular max-w-[8rem]"
                  />
                )}
              </Field>
            </div>

            {/* ⚠️ **L'AVERTISSEMENT EST LE CŒUR DE CETTE CARTE.** Une facture
                camerounaise doit porter le NIU et le RCCM ; en retirant le bloc
                émetteur, le document s'en remet au papier. Si le papier ne les
                porte pas, la facture n'est pas conforme — et rien, à part ce
                texte, ne le dirait à l'utilisateur. */}
            <div className="space-y-3 border-t border-line pt-4">
              <Switch
                checked={keepLegal}
                onCheckedChange={setKeepLegal}
                label="Garder la ligne légale en bas de page"
              />
              <p
                className={
                  keepLegal
                    ? 'text-[12.5px] leading-relaxed text-ink-2'
                    : 'flex items-start gap-2 rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed text-status-overdue'
                }
              >
                {!keepLegal && <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />}
                {keepLegal
                  ? 'Raison sociale, ville, RCCM et NIU restent imprimés discrètement en bas de chaque page, même sous votre en-tête.'
                  : 'Votre papier à en-tête DOIT alors porter votre NIU et votre RCCM : sans eux, la facture n’est pas conforme. Vérifiez-le avant d’émettre.'}
              </p>
            </div>
          </>
        )}

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
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-status-paid">
            <Check className="h-4 w-4" aria-hidden />
            {succes}
          </p>
        )}

        <div className="border-t border-line pt-4">
          <Button type="button" onClick={enregistrer} disabled={enCours}>
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Enregistrer
          </Button>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
            Les documents <strong className="font-semibold">déjà téléchargés</strong> ne changent
            pas. Le réglage s’applique aux PDF générés à partir de maintenant.
          </p>
        </div>
      </div>
    </Card>
  );
}
