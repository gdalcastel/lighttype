import { Header, Footer } from "@/components/layout/Header";
import { LandingPage } from "@/components/landing/LandingPage";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-full">
      <Header
        action={
          <Button asChild size="sm">
            <Link href="/create">Create your letters</Link>
          </Button>
        }
      />
      <main>
        <LandingPage />
      </main>
      <Footer />
    </div>
  );
}
