import type { Metadata } from "next";
import "./globals.css";
import Navbar from "../components/navbar";

export const metadata: Metadata = {
  title: "DRT Maintenance Dashboard",
  description: "Maintenance dashboard for DRT",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-900 bg-gray-50">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
