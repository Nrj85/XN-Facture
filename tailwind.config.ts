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
        brand: {
          DEFAULT: '#CE4A14', // fond de bouton : 4.55:1 avec du texte blanc
          hover: '#B03D0F', // survol, et couleur de texte obligatoire sur brand-soft
          bright: '#E2571F', // accents et repères, jamais sous du texte blanc
          soft: '#FDF1EA',
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
