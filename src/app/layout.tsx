import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'LILA BLACK — Player Journey Visualization',
  description: 'Explore 5 days of battle-royale gameplay data. Visualize player journeys, combat events, and density heatmaps across 796 matches on 3 maps.',
  keywords: ['LILA BLACK', 'game analytics', 'player journey', 'heatmap', 'battle royale'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-gray-950 text-gray-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
