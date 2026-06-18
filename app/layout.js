import "./globals.css";
import { Quicksand } from "next/font/google";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-quicksand",
});

export const metadata = {
  title: "jazztinn legaspi",
  description: "Portfolio of Jazztinn Legaspi — developer, illustrator, writer.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={quicksand.variable}>
      <body>{children}</body>
    </html>
  );
}
