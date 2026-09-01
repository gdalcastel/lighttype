"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { NumericSlider } from "@/components/ui/numeric-slider";
import { Progress } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { FontSelector } from "@/components/creator/FontSelector";
import { LetterPreview } from "@/components/preview/LetterPreview";
import { downloadUrl, fetchFonts, fetchJob, fetchPlugProfiles, fetchPreview, saveProject, startStlJob } from "@/lib/api";
import { useCreatorStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { JobStatus, PreviewData } from "@/types";

const STAGES = [
  { id: "building_geometry", label: "Building geometry" },
  { id: "creating_hollow", label: "Creating hollow bodies" },
  { id: "creating_fronts", label: "Creating removable fronts" },
  { id: "adding_plugs", label: "Adding mounting plugs" },
  { id: "validating", label: "Validating STL" },
];

export function CreatorApp() {
  const store = useCreatorStore();
  const [fonts, setFonts] = useState<{ id: string; name: string; category: string }[]>([]);
  const [plugNote, setPlugNote] = useState("Prototype mounting profile");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<{ message: string; suggestion?: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [openJob, setOpenJob] = useState(false);

  const previewKey = useMemo(
    () =>
      JSON.stringify({
        text: store.text,
        fontId: store.fontId,
        heightMm: store.heightMm,
        wallMm: store.wallMm,
        spacingMm: store.spacingMm,
      }),
    [store.text, store.fontId, store.heightMm, store.wallMm, store.spacingMm],
  );

  useEffect(() => {
    fetchFonts()
      .then((res) => setFonts(res.fonts))
      .catch(() => toast.error("We couldn't load the font library."));
    fetchPlugProfiles()
      .then((res) => {
        const profile = res.profiles[0];
        if (profile) setPlugNote(profile.subtitle);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const text = store.text.trim();
    if (!text) return;
    const handle = window.setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const data = await fetchPreview({
          text,
          font_id: store.fontId,
          height_mm: store.heightMm,
          wall_mm: store.wallMm,
          spacing_mm: store.spacingMm,
        });
        setPreview(data);
        setPreviewError(null);
      } catch (err) {
        const error = err as Error & { suggestion?: string };
        setPreviewError({ message: error.message, suggestion: error.suggestion });
      } finally {
        setLoadingPreview(false);
      }
    }, 280);
    return () => window.clearTimeout(handle);
  }, [previewKey, store.fontId, store.heightMm, store.spacingMm, store.text, store.wallMm]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const t = window.setInterval(async () => {
      try {
        const next = await fetchJob(job.job_id);
        setJob(next);
      } catch {
        window.clearInterval(t);
      }
    }, 450);
    return () => window.clearInterval(t);
  }, [job]);

  const hasText = store.text.trim().length > 0;
  const shownPreview = hasText ? preview : null;
  const shownError = hasText ? previewError : null;
  const letterCount = shownPreview?.letter_count ?? 0;
  const charCount = store.text.length;

  async function onSave() {
    try {
      localStorage.setItem("lighttype-project-manual", JSON.stringify(useCreatorStore.getState()));
      await saveProject(useCreatorStore.getState());
      toast.success("Saved on this device");
    } catch {
      toast.success("Saved on this device");
    }
  }

  async function onGenerate() {
    if (!store.text.trim()) {
      toast.error("Type a name or word first.");
      return;
    }
    try {
      const started = await startStlJob(useCreatorStore.getState());
      setJob({
        job_id: started.job_id,
        status: started.status,
        stage: "queued",
        stage_label: "Queued",
        progress: 4,
        error: null,
        result: null,
      });
      setOpenJob(true);
    } catch (err) {
      const error = err as Error & { suggestion?: string };
      toast.error(error.message, { description: error.suggestion });
    }
  }

  const stageIndex = STAGES.findIndex((s) => s.id === job?.stage);

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        <aside className="border-b border-border lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-5 py-4 md:px-6">
            <div>
              <p className="text-[13px] text-muted">LightType</p>
              <h1 className="text-[22px] font-medium tracking-tight">Create your letters</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={onSave}>
              Save
            </Button>
          </div>
          <div className="space-y-8 px-5 pb-28 md:px-6 lg:pb-10">
            <Section title="Text">
              <Input
                value={store.text}
                onChange={(e) => store.setText(e.target.value)}
                placeholder="Type something..."
                aria-label="Letter text"
                className="h-14 text-[22px] tracking-wide"
              />
              <div className="mt-2 flex items-center justify-between text-[12px] text-muted">
                <span>{charCount}/48</span>
                <span>{letterCount} {letterCount === 1 ? "letter" : "letters"}</span>
              </div>
              {previewError ? (
                <p className="mt-2 text-[13px] leading-5 text-accent">
                  {previewError.message}
                  {previewError.suggestion ? ` ${previewError.suggestion}` : ""}
                </p>
              ) : null}
            </Section>

            <Section title="Style">
              <FontSelector
                fonts={fonts}
                selectedId={store.fontId}
                sample={store.text}
                onSelect={store.setFontId}
              />
            </Section>

            <Section title="Size">
              <div className="space-y-5">
                <NumericSlider
                  label="Height"
                  value={store.heightMm}
                  min={30}
                  max={250}
                  onChange={(heightMm) => store.patch({ heightMm })}
                />
                <NumericSlider
                  label="Depth"
                  value={store.depthMm}
                  min={12}
                  max={50}
                  step={0.5}
                  onChange={(depthMm) => store.patch({ depthMm })}
                />
                <NumericSlider
                  label="Letter spacing"
                  value={store.spacingMm}
                  min={0}
                  max={40}
                  onChange={(spacingMm) => store.patch({ spacingMm })}
                />
                <NumericSlider
                  label="Wall thickness"
                  value={store.wallMm}
                  min={1}
                  max={5}
                  step={0.1}
                  onChange={(wallMm) => store.patch({ wallMm })}
                />
              </div>
            </Section>

            <Accordion type="single" collapsible>
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced customization</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-5 pt-2">
                    <NumericSlider
                      label="Front thickness"
                      value={store.frontMm}
                      min={0.8}
                      max={4}
                      step={0.1}
                      onChange={(frontMm) => store.patch({ frontMm })}
                    />
                    <NumericSlider
                      label="Front tolerance"
                      value={store.frontToleranceMm}
                      min={0.1}
                      max={0.8}
                      step={0.05}
                      onChange={(frontToleranceMm) => store.patch({ frontToleranceMm })}
                    />
                    <NumericSlider
                      label="Snap-fit tolerance"
                      value={store.snapFitToleranceMm}
                      min={0.1}
                      max={0.8}
                      step={0.05}
                      onChange={(snapFitToleranceMm) => store.patch({ snapFitToleranceMm })}
                    />
                    <NumericSlider
                      label="Snap-fit depth"
                      value={store.snapFitDepthMm}
                      min={0.4}
                      max={2.5}
                      step={0.1}
                      onChange={(snapFitDepthMm) => store.patch({ snapFitDepthMm })}
                    />
                    <NumericSlider
                      label="Plug diameter"
                      value={store.plugDiameterMm ?? 8}
                      min={4}
                      max={16}
                      step={0.5}
                      onChange={(plugDiameterMm) => store.patch({ plugDiameterMm })}
                      hint={plugNote}
                    />
                    <NumericSlider
                      label="Plug length"
                      value={store.plugLengthMm ?? 12}
                      min={6}
                      max={24}
                      step={0.5}
                      onChange={(plugLengthMm) => store.patch({ plugLengthMm })}
                    />
                    <p className="text-[12px] leading-5 text-muted">
                      Plug position is bottom center. Profile A is a prototype mounting profile — not matched to a physical bar yet.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </aside>

        <section className="flex min-h-[420px] flex-col bg-[#f4efe8] p-3 md:p-5 lg:min-h-0">
          <LetterPreview
            data={shownPreview}
            depthMm={store.depthMm}
            frontMm={store.frontMm}
            showInterior={store.showInterior}
            showLed={store.showLed}
            showBar={store.showBar}
            cameraView={store.cameraView}
            loading={loadingPreview && hasText}
            error={shownError}
            onView={(cameraView) => store.setViewer({ cameraView })}
            onToggle={(key, value) => store.setViewer({ [key]: value })}
          />
        </section>
      </div>

      <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3 md:px-8">
          <p className="hidden text-[13px] text-muted sm:block">
            {letterCount ? `${letterCount} letters · ${letterCount * 2} printable parts` : "Type a word to begin"}
          </p>
          <Button size="lg" className="w-full sm:w-auto" onClick={onGenerate} disabled={!store.text.trim()}>
            Generate STL <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      <Modal
        open={openJob}
        onOpenChange={setOpenJob}
        title={
          job?.status === "completed"
            ? "Your STL is ready ✨"
            : job?.status === "failed"
              ? "We couldn't finish this set"
              : "Creating your letters..."
        }
        description={
          job?.status === "completed"
            ? `${job.result?.text ?? store.text} has been generated successfully.`
            : job?.status === "failed"
              ? job.error?.message
              : "Hollow bodies, snap-fit fronts and mounting plugs are on the way."
        }
      >
        {job?.status === "completed" && job.result ? (
          <div>
            <p className="text-[28px] font-medium tracking-tight">{job.result.text}</p>
            <p className="mt-3 text-[15px] text-muted">
              {job.result.letter_count} letter bodies
              <br />
              {job.result.letter_count} removable fronts
            </p>
            <Button asChild size="lg" className="mt-6 w-full">
              <a href={downloadUrl(job.job_id)}>Download ZIP</a>
            </Button>
          </div>
        ) : job?.status === "failed" ? (
          <div>
            <p className="text-[15px] leading-6 text-muted">{job.error?.suggestion}</p>
            <Button className="mt-6 w-full" variant="secondary" onClick={() => setOpenJob(false)}>
              Adjust and try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Progress value={job?.progress ?? 6} />
            <ul className="space-y-2.5">
              {STAGES.map((stage, i) => {
                const done = stageIndex > i || ((job?.progress ?? 0) >= 92 && i < STAGES.length);
                const current = stage.id === job?.stage;
                return (
                  <li key={stage.id} className="flex items-center gap-2 text-[14px]">
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full",
                        done ? "text-accent" : current ? "text-accent" : "text-border-strong",
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : <span className="size-2 rounded-full bg-current" />}
                    </span>
                    <span className={done || current ? "text-foreground" : "text-muted"}>{stage.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
