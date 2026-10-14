
# InvoiceLite
Made By @Nmspublic [NextMaze Studi] (© 2026 NextMaze Studio. All rights reserved.)
A clean, lightweight, open-source invoice generator built with React, TypeScript, Vite, and Tailwind CSS.

Create professional invoices, manage clients, calculate totals, preview your documents, and export invoices without creating an account or sending your data to a server.
## Stack Used:
[![My Skills](https://skillicons.dev/icons?i=react,ts,vite,tailwind,html,css,github)](https://skillicons.dev)
## Features

- Create, edit, duplicate, and delete invoices
- Dashboard with invoice search and status filters
- Multiple invoice templates
- Business and client information
- Line items, quantities, prices, discounts, and taxes
- Invoice totals and recorded payments
- Live invoice preview
- PDF export and browser printing
- JSON export and backup import
- Browser-based autosaving
- Responsive desktop and mobile layout
- GitHub Pages deployment
- No account or backend required

## Technology

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React icons
- Browser localStorage

## Getting started

InvoiceLite is designed to be hosted on GitHub Pages. You can edit the source files directly through GitHub's website.

### Deploy on GitHub Pages

1. Create a GitHub repository named `InvoiceLite` or choose another repository name.
2. Add all project files, including `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `src/`, and `.github/workflows/deploy.yml`.
3. Commit your files to the `main` branch.
4. Open the repository's **Settings** page.
5. Select **Pages** in the sidebar.
6. Under the build and deployment settings, select **GitHub Actions** as the source.
7. Open the **Actions** tab and wait for the deployment workflow to finish successfully.
8. Open the published website using the URL shown in the deployment workflow.

The Vite configuration uses the repository name to set the GitHub Pages base path automatically during GitHub Actions builds.

### Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite.

### Production build

```bash
npm run build
```

Vite writes the production files to the `dist/` directory.

If your project has a test script configured, run:

```bash
npm test
```

## Data and privacy

InvoiceLite stores invoice information and settings in your browser's localStorage.

- No application backend is required.
- Invoice data is not automatically uploaded to a server.
- Clearing browser storage may permanently remove saved invoices.
- Browser data does not automatically synchronize across devices.
- Export JSON backups regularly if the information matters to you.
- Imported JSON files should only be used if you trust their source.

Do not treat browser storage as an encrypted database or a substitute for secure accounting records.

## PDF export

Use the application's PDF export feature if it is supported by your browser and the installed export utility. Otherwise, choose **Print invoice** and select **Save as PDF** in the browser's print dialog.

Check the generated document before sending it to a client.

## Project structure

```text
InvoiceLite/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── src/
│   ├── components/
│   ├── utils/
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── types.ts
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── LICENSE
└── README.md
```

The exact files may vary as the application evolves.

## License

InvoiceLite is distributed under the MIT License. See `LICENSE` for details.
