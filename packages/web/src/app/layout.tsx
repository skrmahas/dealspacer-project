export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
      <style jsx global>{`
        :root {
          --color-bg: #ffffff;
          --color-bg-tint: #ffffffd9;
          --color-surface: #ffffff;
          --color-border: #dae2eb;
          --color-text: #1f2a37;
          --color-text-muted: #556579;
          --color-heading: #0f2e52;
          --color-accent: #0b7ea4;
          --color-accent-dark: #145f82;
          --color-success: #1c7c54;
          --color-error-bg: #fff6f5;
          --color-error-border: #ffd4cf;
          --color-error-text: #8f2f23;
          --color-gradient-start: #ffe8d6;
          --color-gradient-mid: #f4f8fb;
          --color-gradient-end: #eef2f8;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --color-bg: #1a1d23;
            --color-bg-tint: #1a1d23d9;
            --color-surface: #21242b;
            --color-border: #333840;
            --color-text: #d4d9e0;
            --color-text-muted: #8895a7;
            --color-heading: #c8d6e5;
            --color-accent: #4db8e8;
            --color-accent-dark: #3598c8;
            --color-success: #3ca374;
            --color-error-bg: #2d1f1e;
            --color-error-border: #5c3835;
            --color-error-text: #e8908a;
            --color-gradient-start: #1a1d23;
            --color-gradient-mid: #1e2129;
            --color-gradient-end: #1c1f26;
          }
        }
      `}</style>
    </html>
  );
}
