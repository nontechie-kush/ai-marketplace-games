import './globals.css'

export const metadata = {
  title: 'AI Game Marketplace - Create Games in Minutes',
  description: 'Create, play, and share games using AI. No coding required.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
