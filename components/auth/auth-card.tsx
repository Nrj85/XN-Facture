import { AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Enveloppe commune aux trois écrans d'authentification : titre, sous-titre,
 * bandeau d'erreur, contenu, pied de page.
 *
 * Le bandeau d'erreur porte `role="alert"` : sans lui, un lecteur d'écran
 * n'annonce pas l'échec, et l'utilisateur reste devant un formulaire qui a
 * l'air d'avoir été soumis pour rien.
 */
export function AuthCard({
  title,
  subtitle,
  error,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  error?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-display text-[26px] leading-none sm:text-[32px]">{title}</h1>
        <p className="mt-2 text-sm text-ink-2">{subtitle}</p>
      </header>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-4 py-2.5 text-[13px] font-medium text-status-overdue"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <Card className="p-5 sm:p-6">{children}</Card>

      {footer && <p className="text-center text-[13px] text-ink-2">{footer}</p>}
    </div>
  );
}
