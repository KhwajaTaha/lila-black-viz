import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LILA BLACK — Player Journey Visualization',
  description: 'Explore 5 days of battle-royale gameplay data. Visualize player journeys, combat events, and density heatmaps across 796 matches on 3 maps.',
  keywords: ['LILA BLACK', 'game analytics', 'player journey', 'heatmap', 'battle royale'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
