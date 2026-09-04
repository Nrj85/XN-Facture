'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 256;

/**
 * Redimensionne l'image avant stockage.
 *
 * Le logo finit en `localStorage` (et demain dans une colonne de base) : y
 * pousser un fichier appareil photo de 4 Mo ferait exploser le quota et
 * ralentirait chaque chargement. 256 px suffisent largement pour un en-tête de
 * facture, y compris à l'impression.
 */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Ce fichier n’est pas une image exploitable.'));
      image.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Redimensionnement impossible sur ce navigateur.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        // PNG pour préserver la transparence, qu'un logo a presque toujours.
        resolve(canvas.toDataURL('image/png'));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function LogoUploader({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Choisissez un fichier image (PNG, JPG ou SVG).');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('Image trop lourde : 4 Mo au maximum.');
      return;
    }

    setBusy(true);
    try {
      onChange(await downscale(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import impossible.');
    } finally {
      setBusy(false);
      // Permet de re-sélectionner le même fichier après une suppression.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-sand">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Logo actuel de l’entreprise" className="h-full w-full object-contain p-1.5" />
          ) : (
            <ImagePlus className="h-6 w-6 text-ink-3" strokeWidth={1.8} aria-hidden />
          )}
        </span>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Import…' : value ? 'Remplacer' : 'Choisir une image'}
            </Button>
            {value && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(undefined);
                  setError(null);
                }}
                className="gap-1.5 text-status-overdue hover:bg-status-overdue-bg"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Retirer
              </Button>
            )}
          </div>
          <p className="text-[11.5px] text-ink-3">
            PNG, JPG ou SVG. Redimensionné à 256 px pour rester léger.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {error && <p className="mt-2 text-[11.5px] font-medium text-status-overdue">{error}</p>}
    </div>
  );
}
