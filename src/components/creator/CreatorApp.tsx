"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericSlider } from "@/components/ui/numeric-slider";
import { Progress } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { FontSelector } from "@/components/creator/FontSelector";
import { Logo } from "@/components/layout/Header";
import { LetterPreview } from "@/components/preview/LetterPreview";
import { downloadUrl, fetchFonts, fetchJob, fetchPreview, startStlJob } from "@/lib/api";
import { useCreatorStore } from "@/lib/store";
import type { JobStatus, PreviewData } from "@/types";

function triggerDownload(jobId: string) {
  const a = document.createElement("a");
  a.href = downloadUrl(jobId);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function CreatorApp() {
  const store = useCreatorStore();
  const [fonts, setFonts] = useState<{ id: string; name: string; category: string }[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<{ message: string; suggestion?: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [readyJobId, setReadyJobId] = useState<string | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const downloadedRef = useRef<string | null>(null);

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

  const generateKey = useMemo(
    () =>
      JSON.stringify({
        text: store.text,
        fontId: store.fontId,
        heightMm: store.heightMm,
        depthMm: store.depthMm,
        wallMm: store.wallMm,
        frontMm: store.frontMm,
        spacingMm: store.spacingMm,
        frontToleranceMm: store.frontToleranceMm,
        snapFitToleranceMm: store.snapFitToleranceMm,
        snapFitDepthMm: store.snapFitDepthMm,
        plugDiameterMm: store.plugDiameterMm,
        plugLengthMm: store.plugLengthMm,
        plugProfile: store.plugProfile,
        plugPosition: store.plugPosition,
        frontMount: store.frontMount,
      }),
    [
      store.text,
      store.fontId,
      store.heightMm,
      store.depthMm,
      store.wallMm,
      store.frontMm,
      store.spacingMm,
      store.frontToleranceMm,
      store.snapFitToleranceMm,
      store.snapFitDepthMm,
      store.plugDiameterMm,
      store.plugLengthMm,
      store.plugProfile,
      store.plugPosition,
      store.frontMount,
    ],
  );

  useEffect(() => {
    fetchFonts()
      .then((res) => setFonts(res.fonts))
      .catch(() => toast.error("Couldn't load fonts."));
  }, []);

  useEffect(() => {
    const text = store.text.trim();
    if (!text) {
      setPreview(null);
      setPreviewError(null);
      setLoadingPreview(false);
      return;
    }
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

  useEffect(() => {
    if (job?.status !== "completed" || !job.job_id) return;
    setReadyJobId(job.job_id);
    setReadyKey(pendingKey);
    if (downloadedRef.current === job.job_id) return;
    downloadedRef.current = job.job_id;
    triggerDownload(job.job_id);
  }, [job, pendingKey]);

  const hasText = store.text.trim().length > 0;
  const shownPreview = hasText ? preview : null;
  const shownError = hasText ? previewError : null;
  const generating = Boolean(job && job.status !== "completed" && job.status !== "failed");
  const canRedownload = Boolean(readyJobId && readyKey === generateKey);

  async function onDownload() {
    if (!store.text.trim() || generating) return;
    if (canRedownload && readyJobId) {
      triggerDownload(readyJobId);
      return;
    }
    try {
      const started = await startStlJob(useCreatorStore.getState());
      setPendingKey(generateKey);
      setJob({
        job_id: started.job_id,
        status: started.status,
        stage: "queued",
        stage_label: "Queued",
        progress: 4,
        error: null,
        result: null,
      });
    } catch (err) {
      const error = err as Error & { suggestion?: string };
      toast.error(error.message, { description: error.suggestion });
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <aside className="order-2 flex h-[46vh] w-full shrink-0 flex-col border-t border-border bg-surface md:order-1 md:h-full md:w-[20%] md:min-w-[260px] md:border-t-0 md:border-r">
        <div className="flex h-12 shrink-0 items-center px-4">
          <Logo className="text-[15px]" />
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pb-4">
          <Section title="Text" className="space-y-2">
            <Input
              value={store.text}
              onChange={(e) => store.setText(e.target.value)}
              placeholder="Type here"
              aria-label="Letter text"
              maxLength={48}
              className="h-11 text-[17px] tracking-wide"
            />
            {previewError ? (
              <p className="text-[12px] leading-4 text-accent">{previewError.message}</p>
            ) : null}
          </Section>

          <Section title="Models" className="space-y-2">
            <FontSelector
              fonts={fonts}
              selectedId={store.fontId}
              sample={store.text}
              onSelect={store.setFontId}
            />
          </Section>

          <Section title="Size" className="space-y-2">
            <div className="space-y-3.5">
              <NumericSlider
                compact
                label="Height"
                value={store.heightMm}
                min={30}
                max={250}
                onChange={(heightMm) => store.patch({ heightMm })}
              />
              <NumericSlider
                compact
                label="Depth"
                value={store.depthMm}
                min={12}
                max={50}
                step={0.5}
                onChange={(depthMm) => store.patch({ depthMm })}
              />
              <NumericSlider
                compact
                label="Spacing"
                value={store.spacingMm}
                min={0}
                max={40}
                onChange={(spacingMm) => store.patch({ spacingMm })}
              />
              <NumericSlider
                compact
                label="Wall"
                value={store.wallMm}
                min={1}
                max={5}
                step={0.1}
                onChange={(wallMm) => store.patch({ wallMm })}
              />
            </div>
          </Section>

          <Section title="Front" className="space-y-2">
            <div className="space-y-3.5">
              <NumericSlider
                compact
                label="Thickness"
                value={store.frontMm}
                min={0.8}
                max={4}
                step={0.1}
                onChange={(frontMm) => store.patch({ frontMm })}
              />
              <NumericSlider
                compact
                label="Tolerance"
                value={store.frontToleranceMm}
                min={0.1}
                max={0.8}
                step={0.05}
                onChange={(frontToleranceMm) => store.patch({ frontToleranceMm })}
              />
              <NumericSlider
                compact
                label="Snap-fit gap"
                value={store.snapFitToleranceMm}
                min={0.1}
                max={0.8}
                step={0.05}
                onChange={(snapFitToleranceMm) => store.patch({ snapFitToleranceMm })}
              />
              <NumericSlider
                compact
                label="Snap-fit depth"
                value={store.snapFitDepthMm}
                min={0.4}
                max={2.5}
                step={0.1}
                onChange={(snapFitDepthMm) => store.patch({ snapFitDepthMm })}
              />
            </div>
          </Section>

          <Section title="Plug" className="space-y-2">
            <div className="space-y-3.5">
              <NumericSlider
                compact
                label="Diameter"
                value={store.plugDiameterMm ?? 8}
                min={4}
                max={16}
                step={0.5}
                onChange={(plugDiameterMm) => store.patch({ plugDiameterMm })}
              />
              <NumericSlider
                compact
                label="Length"
                value={store.plugLengthMm ?? 12}
                min={6}
                max={24}
                step={0.5}
                onChange={(plugLengthMm) => store.patch({ plugLengthMm })}
              />
            </div>
          </Section>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border p-4">
          {generating ? <Progress value={job?.progress ?? 6} /> : null}
          {job?.status === "failed" ? (
            <p className="text-[12px] leading-4 text-accent">{job.error?.message ?? "Couldn't generate STL."}</p>
          ) : null}
          <Button
            size="lg"
            className="w-full"
            onClick={onDownload}
            disabled={!store.text.trim() || generating}
          >
            <Download className="size-4" />
            {generating ? "Generating…" : "Download STL"}
          </Button>
        </div>
      </aside>

      <section className="relative order-1 min-h-0 min-w-0 flex-1 md:order-2 md:h-full">
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
  );
}
