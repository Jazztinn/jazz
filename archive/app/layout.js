import "./globals.css";

export const metadata = {
  title: "hi! i'm [name]",
  description: "Placeholder portfolio — illustrator, animator, and developer.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
