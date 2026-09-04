'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CreationNotice } from '@/components/documents/document-created-dialog';

/**
 * Lit le drapeau posé par le formulaire dans l'URL, puis l'efface.
 *
 * Passer par l'URL plutôt que par un état partagé a une raison précise : la
 * confirmation doit s'afficher APRÈS la redirection, sur la page de détail, une
 * fois le document réellement en place. Le drapeau est retiré aussitôt lu — sans
 * quoi un rechargement de la page, ou un lien partagé, rejouerait indéfiniment
 * l'annonce d'une création vieille de trois jours.
 */
export function useCreationNotice(cleanPath: string) {
  const router = useRouter();
  const params = useSearchParams();
  const [notice, setNotice] = useState<CreationNotice | null>(null);

  const created = params.get('cree');
  const sent = params.get('envoye');
  const updated = params.get('maj');

  useEffect(() => {
    const found: CreationNotice | null = created ? (sent ? 'sent' : 'created') : updated ? 'updated' : null;
    if (!found) return;

    setNotice(found);
    router.replace(cleanPath, { scroll: false });
  }, [created, sent, updated, cleanPath, router]);

  return { notice, dismiss: () => setNotice(null) };
}
