import type { Metadata, Viewport } from "next";
import "./zoro.css";

export const metadata: Metadata = {
  title: "ZORO — Réservations Zed Zéro",
  description: "Fiche de préparation des réservations : vols, transport, lits, programme, repas, météo & vent, conseils.",
};

export const viewport: Viewport = {
  themeColor: "#1b1b1f",
  width: "device-width",
  initialScale: 1,
};

export default function ZoroLayout({ children }: { children: React.ReactNode }) {
  return <div className="zoro">{children}</div>;
}
