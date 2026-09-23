import type { fr } from './fr';

/**
 * English dictionary.
 *
 * Typed against the French one, which is the reference: a missing or misspelled
 * key fails `tsc` rather than rendering an empty string in production.
 *
 * Two translation notes worth keeping:
 * - Invoice statuses agree in gender in French (« Envoyée ») but not in
 *   English, so the badge's `label` override matters less here.
 * - Amounts, dates and the documents themselves are NOT translated. Only the
 *   interface chrome is.
 */
export const en: typeof fr = {
  nav: {
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    quotes: 'Quotes',
    clients: 'Clients',
    payments: 'Payments',
    reports: 'Reports',
    help: 'Help and support',
    settings: 'Settings',
    subscription: 'Subscription',
    admin: 'Administration',
    menu: 'Menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    search: 'Search',
    searchLabel: 'Search for an invoice or a client',
    breadcrumb: 'Breadcrumb',
    mainNav: 'Main navigation',
    signOut: 'Sign out',
    newInvoice: 'New invoice',
    newQuote: 'New quote',
    invoiceShort: 'Invoice',
    quoteShort: 'Quote',
    edit: 'Edit',
    logoToDashboard: 'XN-Facture — dashboard',
  },

  status: {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
    accepted: 'Accepted',
    converted: 'Invoiced',
    refused: 'Declined',
    expired: 'Expired',
  },

  common: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    open: 'Open',
    close: 'Close',
    understood: 'Got it',
    downloadPdf: 'Download PDF',
    preparingPdf: 'Preparing…',
    actions: 'Actions',
    loading: 'Loading…',
    noResult: 'No results',
    required: 'Required',
  },

  dashboard: {
    greeting: (prenom: string, entreprise: string) =>
      `Hello ${prenom} — here is where ${entreprise} stands.`,
    title: 'Dashboard',
    invoiceCount: 'Invoices issued',
    invoiceUnit: (n: number) => (n > 1 ? 'invoices' : 'invoice'),
    draftsPending: (n: number) => `${n} draft${n > 1 ? 's' : ''} not sent yet`,
    noDraft: 'No draft pending',
    invoiced: 'Amount invoiced',
    invoicedHint: 'Drafts and cancelled invoices excluded',
    collected: 'Amount collected',
    collectedHint: (part: number) => `${part}% of the amount invoiced`,
    outstanding: 'Still to collect',
    noOverdue: 'No overdue invoice',
    overdueHint: (montant: string, n: number) =>
      `of which ${montant} overdue across ${n} invoice${n > 1 ? 's' : ''}`,
    keyFigures: 'Key figures',

    receivables: 'Client receivables',
    receivablesHint: 'What is still to collect, by age',
    receivablesEmpty: 'No invoice awaiting payment. Everything is collected.',
    overdueShare: (montant: string) => `of which ${montant} overdue`,

    aging: {
      current: 'Not yet due',
      currentHint: 'Still within terms',
      d1_30: '1 to 30 d',
      d1_30Hint: 'Recently late',
      d31_60: '31 to 60 d',
      d31_60Hint: 'Worth chasing',
      d60p: 'Over 60 d',
      d60pHint: 'Debt recovery',
    },

    agingReading: (tranche: string, montant: string, n: number) =>
      `${tranche}: ${montant} across ${n} invoice${n > 1 ? 's' : ''}`,

    agingCount: (n: number, part: number) => `${n} invoice${n > 1 ? 's' : ''} · ${part}%`,

    recent: 'Latest invoices',
    recentSelection: 'Invoices in this selection',
    recentCount: (n: number) =>
      n === 0 ? 'No document to show' : `The ${n} most recent document${n > 1 ? 's' : ''}`,
    seeAll: 'See all invoices',
    emptyTitle: 'No invoice yet',
    emptyFiltered: 'No invoice in this selection',
    emptyText: 'Create your first invoice to start tracking what you are owed.',
    emptyFilteredText: 'Widen the period, or clear the search to see all your invoices again.',

    filtersLabel: 'Filter the dashboard',
    period: 'Period',
    searchPlaceholder: 'Search a client or an invoice number',
    searchAria: 'Search an invoice by client or number',
    reset: 'Reset',
    from: 'From',
    to: 'To',
    rangeInvalid: 'The end date comes before the start date.',
    scopeCount: (n: number) => (n === 0 ? 'No invoice' : `${n} invoice${n > 1 ? 's' : ''}`),
    scopeIssued: () => 'issued between',
    scopeAnd: 'and',
    scopeMatching: 'matching',
    scopeSuffix: 'Every figure below covers this selection only.',
  },

  period: {
    all: 'All time',
    thisMonth: 'This month',
    lastMonth: 'Last month',
    last3Months: 'Last 3 months',
    thisYear: 'This year',
    custom: 'Custom period',
  },

  due: {
    label: (jours: number): string => {
      if (jours === 0) return 'Due today';
      if (jours > 0) return `In ${jours} day${jours > 1 ? 's' : ''}`;
      const retard = Math.abs(jours);
      return `${retard} day${retard > 1 ? 's' : ''} late`;
    },
  },

  table: {
    number: 'Number',
    client: 'Client',
    issued: 'Issued',
    due: 'Due',
    amount: 'Amount',
    status: 'Status',
    actions: 'Actions',
    noNumber: 'No number',
    caption: 'Latest issued invoices',
    collected: (montant: string) => `${montant} collected`,
    dueOn: (date: string) => `Due ${date}`,
  },

  rowActions: {
    label: (numero: string) => `Actions on ${numero}`,
    draft: 'Draft',
    thisDraft: 'this draft',
    open: 'Open the invoice',
    openHint: 'View details and edit.',
    download: 'Download PDF',
    delete: 'Delete the invoice',
    deleteHint: 'Permanent.',
    noAction: 'No action available.',
    confirmTitle: 'Delete this invoice?',
    confirmText: (numero: string, client: string) =>
      `${numero} — ${client}. This cannot be undone.`,
  },

  settings: {
    language: 'Interface language',
    securityTitle: 'Security and sign-in',
    securityHint: 'Your sign-in address and your password. They belong to you alone.',
    emailLabel: 'Email address',
    emailCurrent: (adresse: string) => `You currently sign in with ${adresse}.`,
    emailHint: 'Nothing changes until you confirm: a link is sent to both your old AND your new address, and both must be followed.',
    emailAction: 'Change address',
    emailSent: 'Check both inboxes: the change applies once both links are followed.',
    passwordLabel: 'Password',
    currentPassword: 'Current password',
    currentPasswordHint: 'Required so nobody can change your password from a session left open.',
    newPassword: 'New password',
    newPasswordHint: '8 characters minimum.',
    confirmPassword: 'Confirm the new password',
    passwordAction: 'Change password',
    passwordSaved: 'Password changed.',
    passwordMismatch: 'The two passwords do not match.',
    passwordReveal: 'Show password',
    passwordHide: 'Hide password',
    languageTitle: 'Personal preferences',
    languageHint:
      'These settings only affect you. Your colleagues keep theirs, and your invoices stay in French.',
    yourName: 'Your name',
    yourNameHint:
      'The name that greets you and identifies you inside the app. It does not appear on documents: those are signed by the company’s legal name and legal identifiers.',
    yourNamePlaceholder: 'First and last name',
    nameSaved: 'Name saved.',
    nameRequired: 'Your name is required.',
    languageWhyFrench:
      'PDF documents stay in French: they are Cameroonian accounting records, carrying legal identifiers (NIU, RCCM) that have no translated equivalent.',
    languageSaved: 'Language saved.',
    languageSaving: 'Saving…',
  },
};
