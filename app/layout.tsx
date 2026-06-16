import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบจัดครูสอนแทน",
  description: "MVP สำหรับจัดครูสอนแทนและแลกคาบในโรงเรียน"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
