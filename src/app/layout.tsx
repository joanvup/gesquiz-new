import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baloo2 = Baloo_2({
  variable: "--font-baloo2",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuizColegio — Sistema de Quizzes Escolares",
  description: "Plataforma de gestión y aplicación de quizzes para instituciones educativas. Importa desde Moodle XML, modo seguro y gamificación.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${baloo2.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-surface text-text font-body overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
