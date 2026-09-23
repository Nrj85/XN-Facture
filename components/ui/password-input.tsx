'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Champ de mot de passe avec bascule « afficher / masquer ».
 *
 * Demandé par l'utilisateur : on ne pouvait rien relire de ce qu'on tapait, et
 * changer son mot de passe revenait à saisir deux fois à l'aveugle une chaîne
 * qu'on ne verrait jamais. Sur un téléphone, où la frappe est la moins sûre,
 * c'est précisément là que la relecture compte.
 *
 * ⚠️ **UN SEUL composant pour les sept champs du projet** (connexion,
 * inscription, nouveau mot de passe ×2, sécurité ×3). Le §6.1 l'impose, et le
 * motif a des détails qu'on n'aurait pas recopiés juste sept fois de suite —
 * voir les trois pièges ci-dessous.
 *
 * ⚠️ **PIÈGE DU CLAVIER MOBILE, et c'est le plus sérieux.** En passant le champ
 * de `password` à `text`, on perd les garanties implicites du type : le clavier
 * d'Android et d'iOS applique alors **majuscule automatique, correction
 * orthographique et suggestions**. Quelqu'un qui révèle son mot de passe puis
 * continue de taper obtiendrait un « M » là où il a frappé « m », sans rien
 * voir d'anormal. D'où `autoCapitalize`, `autoCorrect` et `spellCheck` coupés
 * en dur — **ne pas les retirer**. Le téléphone est l'appareil principal de
 * cette audience.
 *
 * ⚠️ **`type="button"` est obligatoire.** Un `<button>` sans type vaut `submit`
 * dans un formulaire : cliquer sur l'œil aurait soumis la connexion.
 *
 * ⚠️ **La bascule reste atteignable au clavier** — pas de `tabIndex={-1}`. Elle
 * se place naturellement entre le champ et le bouton d'envoi, ce qui est
 * l'ordre attendu. Son libellé décrit **ce que le clic va faire**, et change
 * avec l'état : un libellé figé laisserait un lecteur d'écran annoncer
 * « afficher » sur un mot de passe déjà affiché.
 *
 * **L'état n'est pas réinitialisé tout seul.** Ce qui a été révélé le reste
 * jusqu'au prochain clic : une bascule qui se referme d'elle-même, à la perte
 * du focus ou au vidage du champ, surprend plus qu'elle ne protège. Chaque
 * champ a son propre état, donc révéler « nouveau mot de passe » n'affiche pas
 * l'actuel.
 */
export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Libellé du bouton quand le mot de passe est masqué. */
  revealLabel?: string;
  /** Libellé du bouton quand le mot de passe est affiché. */
  hideLabel?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      className,
      disabled,
      revealLabel = 'Afficher le mot de passe',
      hideLabel = 'Masquer le mot de passe',
      ...props
    },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const label = visible ? hideLabel : revealLabel;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          // Voir le piège du clavier mobile en tête de fichier.
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // 44 px à droite : la place du bouton, sinon la fin d'un long mot de
          // passe passe dessous et devient illisible — ce que la bascule est
          // justement censée éviter.
          className={cn('pr-11', className)}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={label}
          title={label}
          className={cn(
            // 36 × 36 : le plancher tactile du §6.5, tenu à l'intérieur d'un
            // champ de 40 px de haut.
            'absolute right-0.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg',
            'text-ink-3 transition-colors duration-150 hover:bg-sand hover:text-ink',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          )}
        </button>
      </div>
    );
  },
);
