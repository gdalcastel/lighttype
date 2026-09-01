"use client";

import { Header } from "@/components/layout/Header";
import { CreatorApp } from "@/components/creator/CreatorApp";

export default function CreatePage() {
  return (
    <div className="min-h-full bg-background">
      <Header />
      <CreatorApp />
    </div>
  );
}
