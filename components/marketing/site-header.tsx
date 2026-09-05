'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CtaButton } from './cta-button';
import styles from './site-header.module.css';

/** Ancres de la page. Une seule source, réutilisée par le bureau et le mobile. */
const LIENS = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#etapes', label: 'Comment ça marche' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#temoignages', label: 'Témoignages' },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Tiroir ouvert : on bloque le défilement du fond, sinon la page glisse
  // derrière le panneau et on perd sa position en le refermant.
  useEffect(() => {
    if (!open) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = precedent;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.inner}>
          <Link href="/" className={styles.brand} onClick={() => setOpen(false)}>
            <span className={styles.mark} aria-hidden>
              XN
            </span>
            <span className={styles.wordmark}>XN-Facture</span>
          </Link>

          <nav className={styles.nav} aria-label="Sections de la page">
            {LIENS.map((lien) => (
              <a key={lien.href} href={lien.href} className={styles.navLink}>
                {lien.label}
              </a>
            ))}
          </nav>

          <div className={styles.actions}>
            <Link href="/connexion" className={styles.signIn}>
              Se connecter
            </Link>
            <span className={styles.ctaDesktop}>
              <CtaButton href="/inscription" size="sm" showIcon={false}>
                Commencer gratuitement
              </CtaButton>
            </span>

            <button
              type="button"
              className={`${styles.burger} ${open ? styles.open : ''}`}
              aria-expanded={open}
              aria-controls="menu-mobile"
              onClick={() => setOpen((v) => !v)}
            >
              <span className={styles.bars} aria-hidden>
                <span className={styles.bar} />
                <span className={styles.bar} />
                <span className={styles.bar} />
              </span>
              <span className="sr-only">{open ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div id="menu-mobile" className={styles.sheet}>
          {LIENS.map((lien, index) => (
            <a
              key={lien.href}
              href={lien.href}
              className={styles.sheetLink}
              // Cascade : 45 ms d'écart, assez pour que l'œil suive, trop peu
              // pour qu'on attende.
              style={{ animationDelay: `${index * 45}ms` }}
              onClick={() => setOpen(false)}
            >
              {lien.label}
            </a>
          ))}
          <div className={styles.sheetActions}>
            <CtaButton href="/inscription" block onClick={() => setOpen(false)}>
              Commencer gratuitement
            </CtaButton>
            <CtaButton href="/connexion" variant="secondary" showIcon={false} block>
              J’ai déjà un compte
            </CtaButton>
          </div>
        </div>
      )}
    </>
  );
}
