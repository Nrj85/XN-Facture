import type { Config } from 'tailwindcss';

/**
 * Design tokens XN-Facture.
 *
 * Direction : fond papier chaud + orange vif, reprise des captures d'inspiration.
 * Les neutres sont volontairement *chauds* (teintés de jaune/brun) : des gris
 * froids posés sur un fond crème paraissent sales.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FBF8F3', // fond de l'application
        surface: '#FFFFFF', // cartes
        sand: {
          DEFAULT: '#F4EFE6', // sidebar, pistes de contrôles
          deep: '#EDE6D9', // survol
        },
        line: {
          DEFAULT: '#E8E1D4',
          strong: '#D8CFBD',
        },
        ink: {
          DEFAULT: '#1B1815', // texte principal
          2: '#5C544A', // secondaire — 7,0:1 sur paper
          3: '#7A7064', // atténué — 4.5:1 sur paper, reste conforme AA
        },
        // Rampe alignée sur le LOGO le 28 sept. 2026 — teinte 11°, relevée au
        // pixel sur `app/icon.png` (#F23005 y occupe 80,6 % de l'image).
        //
        // ⚠️ **L'ORANGE DU LOGO NE PEUT PAS ÊTRE `brand`.** Mesuré : du blanc
        // dessus ne donne que **4,04:1**, sous le plancher de 4,5:1 du §6.7 —
        // et `brand` est le fond des boutons primaires, tous porteurs de texte
        // blanc. Le poser là aurait rendu non conforme chaque bouton du
        // produit. Il vit donc dans `bright`, qui ne passe jamais sous du texte.
        //
        // `DEFAULT` et `hover` sont la MÊME teinte assombrie jusqu'à franchir
        // leur seuil — la famille reste celle du logo, la lisibilité aussi.
        brand: {
          DEFAULT: '#E32D05', // fond de bouton : 4.52:1 avec du texte blanc
          hover: '#C12604', // survol (5.92:1), et texte obligatoire sur brand-soft (5.24:1)
          bright: '#F23005', // LA couleur du logo. Accents, anneau de focus (3.81:1 sur paper)
          soft: '#FDEEEA', // voile de survol
        },
        // Statuts — toujours accompagnés d'un point et d'un libellé, jamais la
        // couleur seule.
        status: {
          paid: '#0B5C43',
          'paid-bg': '#E6F4EE',
          'paid-dot': '#12946B',
          sent: '#92400E',
          'sent-bg': '#FDF0E3',
          'sent-dot': '#DE8A3A',
          draft: '#57534E',
          'draft-bg': '#F1ECE2',
          'draft-dot': '#A89C8B',
          overdue: '#9B1C1C',
          'overdue-bg': '#FCEBEA',
          'overdue-dot': '#D93A2B',
        },
        // Rampe séquentielle d'ancienneté de créance : une seule teinte, du clair
        // au foncé. Plus la dette est vieille, plus la couleur est sombre.
        aging: {
          1: '#E9A06B',
          2: '#D97A34',
          3: '#B4520F',
          4: '#7C3308',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(27, 24, 21, 0.04)',
        raised: '0 2px 8px rgba(27, 24, 21, 0.06), 0 1px 2px rgba(27, 24, 21, 0.04)',
        pop: '0 12px 32px rgba(27, 24, 21, 0.12)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 240ms ease-out both',
        'slide-in': 'slide-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
