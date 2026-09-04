'use client';

import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { usePdfDownload } from '@/lib/pdf/use-pdf-download';

/**
 * Bouton de téléchargement PDF, commun aux factures et aux devis.
 *
 * Il ne connaît plus que deux choses : l'adresse du document et le nom de
 * fichier souhaité. La composition de la charge utile a disparu du navigateur
 * en même temps que le store — c'est le serveur qui lit la base.
 */
export function DownloadPdfButton({
  url,
  filename,
  label = 'Télécharger le PDF',
  variant = 'secondary',
  size = 'md',
}: {
  url: string;
  filename: string;
  label?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
}) {
  const { download, busy, error } = usePdfDownload();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={() => download(url, filename)}
        disabled={busy}
        className="gap-1.5"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        {busy ? 'Préparation…' : label}
      </Button>
      {error && (
        <p role="alert" className="text-[11.5px] font-medium text-status-overdue">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Même action, réduite à une icône, pour les rangées d'actions rapides.
 *
 * L'erreur n'y est pas affichée sur place — il n'y a pas de largeur pour un
 * message dans une ligne de tableau : elle est remontée à l'appelant, qui la
 * présente là où elle sera lue.
 */
export function DownloadPdfIconButton({
  url,
  filename,
  label = 'Télécharger le PDF',
  onError,
}: {
  url: string;
  filename: string;
  label?: string;
  onError?: (message: string) => void;
}) {
  const { download, busy } = usePdfDownload();

  return (
    <IconButton
      icon={busy ? Loader2 : Download}
      label={busy ? 'Préparation du PDF…' : label}
      disabled={busy}
      className={busy ? '[&>svg]:animate-spin motion-reduce:[&>svg]:animate-none' : undefined}
      onClick={async (event) => {
        event.stopPropagation();
        const failure = await download(url, filename);
        if (failure) onError?.(failure);
      }}
    />
  );
}
