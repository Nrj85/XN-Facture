/**
 * Dictionnaire français — **la référence**.
 *
 * Le dictionnaire anglais est typé d'après celui-ci (`typeof fr`) : une clé
 * oubliée ou mal orthographiée fait échouer `tsc` au lieu de laisser une
 * chaîne vide s'afficher en production.
 *
 * ⚠️ **Pas de `as const` ici.** Il figerait chaque chaîne en type littéral, et
 * aucune traduction ne pourrait alors satisfaire une seule clé — `'Dashboard'`
 * n'est pas assignable au type `'Tableau de bord'`. Sans lui, la vérification
 * porte sur la FORME : mêmes clés, mêmes signatures. C'est exactement ce qu'on
 * veut, et l'erreur est déroutante quand on l'oublie.
 *
 * Les valeurs sont soit des chaînes, soit des fonctions quand le texte dépend
 * d'un nombre ou d'un nom. Le pluriel passe par ces fonctions plutôt que par
 * une bibliothèque : deux langues, deux formes, une dépendance de moins.
 */
export const fr = {
  nav: {
    dashboard: 'Tableau de bord',
    invoices: 'Factures',
    quotes: 'Devis',
    clients: 'Clients',
    payments: 'Paiements',
    reports: 'Rapports',
    help: 'Aide et support',
    settings: 'Paramètres',
    subscription: 'Abonnement',
    admin: 'Administration',
    menu: 'Menu',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    search: 'Rechercher',
    searchLabel: 'Rechercher une facture ou un client',
    breadcrumb: 'Fil d’Ariane',
    mainNav: 'Navigation principale',
    signOut: 'Se déconnecter',
    newInvoice: 'Nouvelle facture',
    newQuote: 'Nouveau devis',
    invoiceShort: 'Facture',
    quoteShort: 'Devis',
    edit: 'Modifier',
    logoToDashboard: 'XN-Facture — tableau de bord',
  },

  status: {
    draft: 'Brouillon',
    sent: 'Envoyée',
    paid: 'Payée',
    overdue: 'En retard',
    cancelled: 'Annulée',
    accepted: 'Accepté',
    converted: 'Facturé',
    refused: 'Refusé',
    expired: 'Expiré',
  },

  common: {
    cancel: 'Annuler',
    save: 'Enregistrer',
    delete: 'Supprimer',
    open: 'Ouvrir',
    close: 'Fermer',
    understood: 'J’ai compris',
    downloadPdf: 'Télécharger le PDF',
    preparingPdf: 'Préparation…',
    actions: 'Actions',
    loading: 'Chargement…',
    noResult: 'Aucun résultat',
    required: 'Obligatoire',
  },

  dashboard: {
    greeting: (prenom: string, entreprise: string) =>
      `Bonjour ${prenom} — voici où en est ${entreprise}.`,
    title: 'Tableau de bord',
    invoiceCount: 'Factures émises',
    invoiceUnit: (n: number): string => (n > 1 ? 'factures' : 'facture'),
    draftsPending: (n: number) =>
      `${n} brouillon${n > 1 ? 's' : ''} pas encore envoyé${n > 1 ? 's' : ''}`,
    noDraft: 'Aucun brouillon en attente',
    invoiced: 'Montant facturé',
    invoicedHint: 'Brouillons et factures annulées exclus',
    collected: 'Montant encaissé',
    collectedHint: (part: number) => `${part} % du montant facturé`,
    outstanding: 'Reste à encaisser',
    noOverdue: 'Aucune facture en retard',
    overdueHint: (montant: string, n: number) =>
      `dont ${montant} en retard sur ${n} facture${n > 1 ? 's' : ''}`,
    keyFigures: 'Chiffres clés',

    receivables: 'Encours clients',
    receivablesHint: 'Ce qu’il reste à encaisser, par ancienneté',
    receivablesEmpty: 'Aucune facture en attente de paiement. Tout est encaissé.',
    overdueShare: (montant: string) => `dont ${montant} en retard`,

    aging: {
      current: 'À échoir',
      currentHint: 'Pas encore dues',
      d1_30: '1 à 30 j',
      d1_30Hint: 'Retard récent',
      d31_60: '31 à 60 j',
      d31_60Hint: 'À relancer',
      d60p: 'Plus de 60 j',
      d60pHint: 'Recouvrement',
    },

    /** Phrase lue par les lecteurs d'écran pour chaque tranche de la barre. */
    agingReading: (tranche: string, montant: string, n: number) =>
      `${tranche} : ${montant} sur ${n} facture${n > 1 ? 's' : ''}`,

    /** « 2 factures · 35 % » sous chaque tranche de la barre. */
    agingCount: (n: number, part: number) => `${n} facture${n > 1 ? 's' : ''} · ${part} %`,

    recent: 'Dernières factures',
    recentSelection: 'Factures de la sélection',
    recentCount: (n: number): string =>
      n === 0
        ? 'Aucun document à afficher'
        : `Les ${n} document${n > 1 ? 's' : ''} le${n > 1 ? 's' : ''} plus récent${n > 1 ? 's' : ''}`,
    seeAll: 'Voir toutes les factures',
    emptyTitle: 'Aucune facture',
    emptyFiltered: 'Aucune facture sur cette sélection',
    emptyText: 'Créez votre première facture pour commencer à suivre vos encaissements.',
    emptyFilteredText:
      'Élargissez la période, ou effacez la recherche pour retrouver toutes vos factures.',

    filtersLabel: 'Filtrer le tableau de bord',
    period: 'Période',
    searchPlaceholder: 'Rechercher un client ou un numéro de facture',
    searchAria: 'Rechercher une facture par client ou par numéro',
    reset: 'Réinitialiser',
    from: 'Du',
    to: 'Au',
    rangeInvalid: 'La date de fin précède la date de début.',
    scopeCount: (n: number): string => (n === 0 ? 'Aucune facture' : `${n} facture${n > 1 ? 's' : ''}`),
    scopeIssued: (n: number) => `émise${n > 1 ? 's' : ''} entre le`,
    scopeAnd: 'et le',
    scopeMatching: 'correspondant à',
    scopeSuffix: 'Tous les chiffres ci-dessous ne portent que sur cette sélection.',
  },

  period: {
    all: 'Depuis le début',
    thisMonth: 'Ce mois-ci',
    lastMonth: 'Le mois dernier',
    last3Months: '3 derniers mois',
    thisYear: 'Cette année',
    custom: 'Période personnalisée',
  },

  due: {
    /**
     * « Échéance aujourd'hui », « Dans 6 jours », « Retard de 12 jours ».
     * Déplacé de `lib/format.ts` vers le dictionnaire : c'est du texte
     * d'interface, il doit suivre la langue. `lib/format.ts` ne garde que ce
     * qui est indépendant de la langue — le découpage des dates.
     */
    label: (jours: number): string => {
      if (jours === 0) return "Échéance aujourd'hui";
      if (jours > 0) return `Dans ${jours} jour${jours > 1 ? 's' : ''}`;
      const retard = Math.abs(jours);
      return `Retard de ${retard} jour${retard > 1 ? 's' : ''}`;
    },
  },

  table: {
    number: 'Numéro',
    client: 'Client',
    issued: 'Émission',
    due: 'Échéance',
    amount: 'Montant',
    status: 'Statut',
    actions: 'Actions',
    noNumber: 'Sans numéro',
    caption: 'Dernières factures émises',
    collected: (montant: string) => `${montant} encaissé`,
    dueOn: (date: string) => `Échéance ${date}`,
  },

  rowActions: {
    label: (numero: string) => `Actions sur ${numero}`,
    draft: 'Brouillon',
    thisDraft: 'ce brouillon',
    open: 'Ouvrir la facture',
    openHint: 'Voir le détail et modifier.',
    download: 'Télécharger le PDF',
    delete: 'Supprimer la facture',
    deleteHint: 'Définitif.',
    noAction: 'Aucune action disponible.',
    confirmTitle: 'Supprimer cette facture ?',
    confirmText: (numero: string, client: string) =>
      `${numero} — ${client}. Cette action est irréversible.`,
  },

  settings: {
    language: 'Langue de l’interface',
    securityTitle: 'Sécurité et connexion',
    securityHint: 'Votre adresse de connexion et votre mot de passe. Ils n’appartiennent qu’à vous.',
    emailLabel: 'Adresse email',
    emailCurrent: (adresse: string) => `Vous vous connectez aujourd’hui avec ${adresse}.`,
    emailHint: 'Rien ne change tant que vous n’avez pas confirmé : un lien part vers votre ancienne ET votre nouvelle adresse, et les deux doivent être suivis.',
    emailAction: 'Changer d’adresse',
    emailSent: 'Vérifiez vos deux boîtes : le changement s’appliquera une fois les liens suivis.',
    passwordLabel: 'Mot de passe',
    currentPassword: 'Mot de passe actuel',
    currentPasswordHint: 'Demandé pour que personne ne puisse changer votre mot de passe depuis une session laissée ouverte.',
    newPassword: 'Nouveau mot de passe',
    newPasswordHint: '8 caractères au minimum.',
    confirmPassword: 'Confirmer le nouveau mot de passe',
    passwordAction: 'Changer le mot de passe',
    passwordSaved: 'Mot de passe changé.',
    passwordMismatch: 'Les deux mots de passe ne correspondent pas.',
    languageTitle: 'Préférences personnelles',
    languageHint:
      'Ces réglages ne concernent que vous. Vos collègues gardent les leurs, et vos factures restent en français.',
    yourName: 'Votre nom',
    yourNameHint:
      'Le nom qui vous accueille et qui vous identifie dans l’application. Il n’apparaît pas sur les documents : ce sont la raison sociale et les mentions légales de l’entreprise qui les signent.',
    yourNamePlaceholder: 'Prénom et nom',
    nameSaved: 'Nom enregistré.',
    nameRequired: 'Le nom est obligatoire.',
    languageWhyFrench:
      'Les documents PDF restent en français : ce sont des pièces comptables camerounaises, portant des mentions légales (NIU, RCCM) sans équivalent traduit.',
    languageSaved: 'Langue enregistrée.',
    languageSaving: 'Enregistrement…',
  },
};
