"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LetterPreview } from "@/components/preview/LetterPreview";
import { fetchPreview } from "@/lib/api";
import type { PreviewData } from "@/types";

export function HeroPreview() {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; suggestion?: string } | null>(null);
  const [view, setView] = useState<"front" | "back" | "side" | "reset">("front");
  const [showInterior, setShowInterior] = useState(false);
  const [showLed, setShowLed] = useState(true);
  const [showBar, setShowBar] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchPreview({
      text: "GUILI",
      font_id: "montserrat-bold",
      height_mm: 100,
      wall_mm: 2,
      spacing_mm: 10,
    })
      .then((res) => {
        if (!alive) return;
        setData(res);
        setError(null);
      })
      .catch((err: Error & { suggestion?: string }) => {
        if (!alive) return;
        setData(null);
        setError({
          message: err.message || "We couldn't load the 3D example.",
          suggestion: err.suggestion ?? "Refresh the page to try again.",
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_20px_60px_rgba(34,34,34,0.06)]">
      <div className="aspect-[16/10] min-h-[320px] md:min-h-[460px]">
        <LetterPreview
          data={data}
          depthMm={25}
          frontMm={1.5}
          showInterior={showInterior}
          showLed={showLed}
          showBar={showBar}
          cameraView={view}
          loading={loading}
          error={error}
          onView={setView}
          onToggle={(key, value) => {
            if (key === "showInterior") setShowInterior(value);
            if (key === "showLed") setShowLed(value);
            if (key === "showBar") setShowBar(value);
          }}
        />
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div>
      <section className="mx-auto max-w-[1120px] px-5 pt-14 pb-10 md:px-8 md:pt-24 md:pb-16">
        <p className="mb-5 text-[13px] font-medium tracking-[0.14em] text-muted uppercase">
          LightType
        </p>
        <h1 className="hero-title max-w-[16ch] text-[40px] font-medium text-foreground md:text-[64px]">
          Create illuminated 3D letters.
        </h1>
        <p className="mt-5 max-w-[28ch] text-[22px] leading-8 tracking-tight text-foreground/80 md:text-[28px] md:leading-10">
          Type it. Light it. Print it.
        </p>
        <p className="mt-6 max-w-[42ch] text-[16px] leading-7 text-muted md:text-[17px]">
          Turn any name, word or phrase into custom hollow 3D letters designed for LED lighting and 3D printing.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="xl">
            <Link href="/create">
              Create your letters <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="xl">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-20 md:px-8">
        <HeroPreview />
      </section>

      <section id="how-it-works" className="mx-auto max-w-[1120px] px-5 py-16 md:px-8 md:py-24">
        <h2 className="text-[28px] font-medium tracking-tight md:text-[36px]">How it works</h2>
        <p className="mt-3 max-w-[46ch] text-[16px] leading-7 text-muted">
          You don’t need to know 3D modeling. Just type what you want.
        </p>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            ["1", "Type", "Enter a name, word or phrase. The preview updates as you go."],
            ["2", "Choose a style", "Pick a font from visual cards that show your actual text."],
            ["3", "Customize", "Set height, depth and spacing. Advanced details stay tucked away."],
            ["4", "Preview", "Rotate the illuminated letters, look inside, and check the mounting bar."],
            ["5", "Generate", "We build a hollow body and a snap-fit front for every character."],
            ["6", "Download", "Get individual STL files, ready to print, packed with a project README."],
          ].map(([n, title, body]) => (
            <li key={n} className="card-surface p-6">
              <span className="text-[13px] font-medium text-accent">{n}</span>
              <h3 className="mt-3 text-[20px] font-medium tracking-tight">{title}</h3>
              <p className="mt-2 text-[15px] leading-6 text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 pb-20 md:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          {[
            ["Individual letters", "Every character is its own printable piece — never one combined mesh."],
            ["Hollow for LEDs", "Each body has a cavity sized for LED strip lighting and a removable front."],
            ["Snap-fit fronts", "No glue in the default setup. The front locks into the body with a mechanical lip."],
            ["Prototype mounting plug", "A parameterized rear plug aligns each letter to a visual electrified bar."],
          ].map(([title, body]) => (
            <article key={title} className="card-surface p-7">
              <h3 className="text-[20px] font-medium tracking-tight">{title}</h3>
              <p className="mt-2 text-[15px] leading-6 text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 pb-24 md:px-8">
        <div className="rounded-[28px] bg-foreground px-8 py-14 text-center text-white md:px-16">
          <h2 className="text-[32px] font-medium tracking-tight md:text-[40px]">
            Ready when you are.
          </h2>
          <p className="mx-auto mt-3 max-w-[34ch] text-[16px] leading-7 text-white/70">
            Start with GUILI, or type your own word. Your first set of letters is a few clicks away.
          </p>
          <Button asChild size="xl" className="mt-8 bg-accent hover:bg-accent-hover">
            <Link href="/create">
              Create your letters <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
