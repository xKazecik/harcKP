/**
 * Tokeny CSS design systemu (§16.1–§16.2), trzy warstwy:
 * prymitywy → semantyczne → komponentowe (komponentowe dojdą w etapie 11).
 *
 * Motyw ciemny: bez czystej czerni i czystej bieli; czerwień ostrzegawcza
 * jaśniejsza i mniej nasycona. Oba motywy spełniają WCAG AA.
 */
export const tokensCss = `
:root {
  /* prymitywy */
  --gray-0: #ffffff;
  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
  --gray-200: #e2e8f0;
  --gray-300: #cbd5e1;
  --gray-500: #64748b;
  --gray-700: #334155;
  --gray-800: #1e293b;
  --gray-900: #0f172a;
  --green-600: #16a34a;
  --amber-600: #d97706;
  --red-600: #dc2626;
  --red-400: #f87171;
  --blue-600: #2563eb;
  --blue-400: #60a5fa;

  /* semantyczne — motyw jasny */
  --surface: var(--gray-50);
  --surface-raised: var(--gray-0);
  --border: var(--gray-200);
  --text: var(--gray-900);
  --text-muted: var(--gray-500);
  --accent: var(--blue-600);
  --success: var(--green-600);
  --warning: var(--amber-600);
  --danger: var(--red-600);
  --info: var(--blue-600);
}

.dark {
  /* semantyczne — motyw ciemny (bez #000 i czystej bieli) */
  --surface: var(--gray-900);
  --surface-raised: var(--gray-800);
  --border: var(--gray-700);
  --text: var(--gray-100);
  --text-muted: var(--gray-300);
  --accent: var(--blue-400);
  --success: #4ade80;
  --warning: #fbbf24;
  --danger: var(--red-400);
  --info: var(--blue-400);
}

@media print {
  /* Wydruki i PDF-y zawsze jasne (§16.2) */
  :root, .dark {
    --surface: #ffffff;
    --surface-raised: #ffffff;
    --border: #e2e8f0;
    --text: #0f172a;
    --text-muted: #64748b;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;
