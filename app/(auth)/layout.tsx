import { Logo } from '@/components/layout/logo';

/**
 * Coquille des écrans d'authentification.
 *
 * Volontairement dépouillée : ni barre latérale ni fil d'Ariane, puisqu'il n'y
 * a rien à naviguer tant qu'on n'est pas entré. Le fond `paper` et les jetons
 * restent ceux de l'application — la page de connexion doit appartenir au même
 * produit que le reste.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="px-4 py-6 sm:px-6 lg:px-8">
        <Logo />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:px-6">
        <div className="w-full max-w-[420px] animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
