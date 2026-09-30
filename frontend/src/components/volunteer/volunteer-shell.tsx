"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Clipboard, FileAudio, LocateFixed, Mic, Pause, RefreshCcw, RotateCcw, Send, ShieldCheck, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { citizenApi, TERMINAL_CITIZEN_STAGES } from "@/lib/api/citizen";
import { nextCitizenPollDelay } from "@/lib/api/polling";
import { isApiError } from "@/lib/api/errors";
import { adaptCitizenRequest } from "@/lib/api/adapters";
import type { ApproximateLocation, CitizenStatus, CreateCitizenRequest } from "@/lib/api/types";
import { usePublicLocale } from "@/components/providers/public-locale-provider";
import { useMobileKeyboardInset } from "@/components/navigation/mobile-bottom-navigation";
import { convertRecordedAudioToWav } from "@/lib/media/wav";

const trackingKey = "civicbridge:request-id";
const countries = [{ code: "IN", name: "India" }, { code: "BR", name: "Brazil" }, { code: "ZA", name: "South Africa" }] as const;
const languages = [{ value: "en-IN", label: "English (India)" }, { value: "hi-IN", label: "Hindi" }, { value: "pt-BR", label: "Portuguese (Brazil)" }, { value: "en-ZA", label: "English (South Africa)" }];

function stageLabel(value?: string) { return value ? value.replaceAll("_", " ") : "not submitted"; }

export function VolunteerShell() {
  const { t } = usePublicLocale();
  const keyboardInset = useMobileKeyboardInset();
  const [inputMode, setInputMode] = useState<"write" | "record">("write");
  const [replacement, setReplacement] = useState<{ kind: "record" } | { kind: "file"; file: File } | null>(null);
  const searchParams = useSearchParams();
  const initialCountry = searchParams.get("country");
  const sourceHotspot = searchParams.get("source_hotspot");
  const sourceCategory = searchParams.get("category");
  const reducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCount = useRef(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [country, setCountry] = useState<"IN" | "BR" | "ZA">(initialCountry === "BR" || initialCountry === "ZA" ? initialCountry : "IN");
  const [language, setLanguage] = useState("en-IN");
  const [adminHint, setAdminHint] = useState(() => searchParams.get("administrative_area") ?? "");
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [location, setLocation] = useState<ApproximateLocation | null>(null);
  const [attachment, setAttachment] = useState<File | Blob | null>(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [recording, setRecording] = useState(false);
  const [polling, setPolling] = useState(true);
  const [correction, setCorrection] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [submissionPhase, setSubmissionPhase] = useState<"saving" | "uploading">("saving");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const validationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!keyboardInset || window.innerWidth >= 768) return;
    const frame = requestAnimationFrame(() => {
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !field.closest(".citizen-intake")) return;
      const viewport = window.visualViewport;
      const actionHeight = document.querySelector(".intake-actions")?.getBoundingClientRect().height ?? 64;
      const availableBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - actionHeight - 16;
      const obscured = field.getBoundingClientRect().bottom - availableBottom;
      if (obscured > 0) window.scrollBy({ top: obscured, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [keyboardInset]);

  useEffect(() => () => { if (recordingTimeout.current) clearTimeout(recordingTimeout.current); const recorder = mediaRecorder.current; if (recorder) { recorder.onstop = null; if (recorder.state !== "inactive") recorder.stop(); } stream.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [recording]);
  useEffect(() => () => { if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl); }, [audioPreviewUrl]);

  const savedTracking = useQuery({ queryKey: ["citizen", "saved-tracking"], queryFn: () => typeof window === "undefined" ? null : window.localStorage.getItem(trackingKey), staleTime: Infinity });
  const activeId = requestId ?? savedTracking.data ?? null;

  const statusQuery = useQuery({
    queryKey: ["citizen", "status", activeId],
    queryFn: ({ signal }) => { if (!activeId) throw new Error("No request ID"); pollCount.current += 1; if (pollCount.current >= 8) setPolling(false); return citizenApi.status(activeId, signal); },
    enabled: Boolean(activeId),
    retry: false,
    refetchInterval: (query) => {
      const value = query.state.data;
      return nextCitizenPollDelay(value?.processing_stage, pollCount.current, polling);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!consent) throw new Error("Consent is required before submission.");
      if (!text.trim() && !attachment) throw new Error("Add a written report, recording, or evidence file.");
      if (!location && !adminHint.trim()) throw new Error("Add an administrative area or choose approximate browser location.");
      setSubmissionPhase("saving");
      const payload: CreateCitizenRequest = adaptCitizenRequest({ channel: attachment?.type.startsWith("audio/") ? "web_voice" : "web_text", country_code: country, language_hint: language, location: location ? { ...location, admin_hint: adminHint.trim() || undefined } : undefined, administrative_area: adminHint.trim() || undefined, consentAccepted: consent, text: text.trim() || undefined });
      const receipt = await citizenApi.create(payload, crypto.randomUUID());
      if (attachment) {
        setSubmissionPhase("uploading");
        await citizenApi.upload(receipt.request_id, attachment, attachmentName || "citizen-evidence.bin");
      }
      return receipt;
    },
    onSuccess: async (receipt) => {
      setValidationError(null);
      window.localStorage.setItem(trackingKey, receipt.request_id);
      setRequestId(receipt.request_id); setPolling(true); pollCount.current = 0;
      await queryClient.invalidateQueries({ queryKey: ["citizen"] });
      toast.success(`Request accepted. Receipt ${receipt.receipt_id}`);
    },
    onError: (error) => { setValidationError(error.message); requestAnimationFrame(() => validationRef.current?.focus()); toast.error(error.message); },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!activeId) throw new Error("No request to confirm.");
      if (correction.trim()) await citizenApi.correct(activeId, { reason: "Citizen correction after normalization review", notes: correction.trim() });
      return citizenApi.confirm(activeId, location ? { ...location, admin_hint: adminHint.trim() || undefined } : undefined, correction.trim() || undefined);
    },
    onSuccess: async () => { toast.success("Report confirmed. Processing will continue."); setCorrection(""); setPolling(true); pollCount.current = 0; await statusQuery.refetch(); },
    onError: (error) => toast.error(error.message),
  });

  const countryName = useMemo(() => countries.find((item) => item.code === country)?.name ?? country, [country]);

  function changeCountry(value: "IN" | "BR" | "ZA") {
    setCountry(value);
  }

  async function toggleRecording() {
    if (recording) { mediaRecorder.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { toast.error("Recording is unavailable in this browser. Upload an audio file instead."); return; }
    try {
      const inputStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = inputStream; chunks.current = [];
      const recorder = new MediaRecorder(inputStream);
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      recorder.onstop = async () => {
        if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
        const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        inputStream.getTracks().forEach((track) => track.stop()); stream.current = null;
        try { const wav = await convertRecordedAudioToWav(blob); if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl); setAttachment(wav); setAttachmentName("citizen-recording.wav"); setAudioPreviewUrl(URL.createObjectURL(wav)); toast.success("Recording ready for review and upload."); }
        catch { toast.error("This browser could not prepare the recording. Upload a WAV, MP3, M4A, or OGG file instead."); }
        finally { setRecording(false); }
      };
      recorder.start(500); setRecordingSeconds(0); setRecording(true); recordingTimeout.current = setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 60_000);
    } catch { toast.error("Microphone permission was not granted. You can upload an audio file."); }
  }

  function requestLocation() {
    if (!navigator.geolocation) { toast.error("Browser geolocation is unavailable."); return; }
    navigator.geolocation.getCurrentPosition((position) => { setLocation({ precision: "approximate", latitude: Math.round(position.coords.latitude * 100) / 100, longitude: Math.round(position.coords.longitude * 100) / 100, admin_hint: adminHint || undefined }); toast.success("Approximate area added with reduced precision."); }, () => toast.error("Location permission was not granted."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  function resumePolling() { pollCount.current = 0; setPolling(true); void statusQuery.refetch(); }
  function clearTracking() { if (typeof window !== "undefined") window.localStorage.removeItem(trackingKey); setRequestId(null); queryClient.setQueryData(["citizen", "saved-tracking"], null); setPolling(false); }
  function selectAttachment(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Choose a file smaller than 10 MB."); return; }
    if (!file.type.startsWith("audio/") && !["image/jpeg", "image/png"].includes(file.type)) { toast.error("Use a supported audio, JPG, or PNG file."); return; }
    setAttachment(file); setAttachmentName(file.name);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(file.type.startsWith("audio/") ? URL.createObjectURL(file) : null);
  }

  function deleteAttachment() {
    setAttachment(null); setAttachmentName(""); setAudioPreviewUrl(null); setReplacement(null);
  }
  function requestRecording() {
    if (!recording && attachment) { setReplacement({ kind: "record" }); return; }
    void toggleRecording();
  }
  function requestAttachment(file?: File) {
    if (!file) return;
    if (attachment) setReplacement({ kind: "file", file });
    else selectAttachment(file);
  }
  function confirmReplacement() {
    const next = replacement; setReplacement(null);
    if (next?.kind === "record") void toggleRecording();
    else if (next?.kind === "file") selectAttachment(next.file);
  }

  function focusValidation(message: string) {
    setValidationError(message);
    requestAnimationFrame(() => validationRef.current?.focus());
  }
  function goToLocation() {
    if (recording) return;
    if (!text.trim() && !attachment) return focusValidation("Add a written report or voice recording before continuing.");
    setValidationError(null); setStep(2);
  }
  function goToReview() {
    if (!location && !adminHint.trim()) return focusValidation("Add an administrative area or explicitly choose approximate browser location.");
    setValidationError(null); setStep(3);
  }
  function submit() {
    if (!consent) return focusValidation("Consent is required before submission.");
    setValidationError(null); createMutation.mutate();
  }
  async function copyRequestId() {
    if (!activeId) return;
    try { await navigator.clipboard.writeText(activeId); toast.success("Request ID copied."); }
    catch { toast.error("Copy failed. Select the request ID manually."); }
  }

  const status = statusQuery.data;
  return (
    <main id="main-content" data-keyboard-open={keyboardInset > 0} style={{ "--keyboard-inset": `${keyboardInset}px` } as CSSProperties} className="citizen-intake min-h-screen bg-background px-4 py-5 pb-[max(6rem,env(safe-area-inset-bottom))] text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <motion.header initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="intake-header">
          <h1 data-no-ui-translation className="font-heading font-normal">{t("intakeTitle")}</h1>
          <p data-no-ui-translation className="mt-2 text-sm text-muted-foreground">{t("intakeIntro")}</p>
        </motion.header>

        {sourceHotspot ? <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4" role="status"><p className="font-semibold">You’re responding to a public hotspot{sourceCategory ? ` about ${sourceCategory.replaceAll("_", " ")}` : ""}.</p><p className="mt-1 text-sm text-muted-foreground">Country and administrative area were prefilled. Describe only your own experience; nothing is submitted automatically and no coordinates were copied.</p></div> : null}
        {validationError ? <div ref={validationRef} tabIndex={-1} role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4"><p className="font-semibold">Please check this step</p><p className="mt-1 text-sm">{validationError}</p></div> : null}

        <Card><CardHeader className="intake-card-header"><ol className="intake-progress" aria-label="Report steps">{[1,2,3].map((value) => <li key={value} aria-current={step === value ? "step" : undefined}>{value} · <span>{value === 1 ? "Describe" : value === 2 ? "Locate & attach" : "Review"}</span></li>)}</ol>{step !== 1 ? <><CardTitle>{step === 2 ? "Add an area and optional evidence" : "Review and submit"}</CardTitle>{step === 2 ? <CardDescription>Your report location starts empty. Browser location is used only with your permission.</CardDescription> : null}</> : null}</CardHeader>
          <CardContent className="intake-card-content space-y-4">
            {replacement ? <div data-no-ui-translation role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-4"><p className="font-semibold">{t("replaceTitle")}</p><p className="mt-2 break-words text-sm">{attachmentName}</p><p className="mt-2 text-sm">{t("replaceBody")}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setReplacement(null)}>{t("keepAttachment")}</Button><Button onClick={confirmReplacement}>{t(replacement.kind === "record" ? "replaceRecord" : "replaceFile")}</Button></div></div> : null}
            {step === 1 ? <>
              <div data-no-ui-translation className="input-mode" role="group" aria-label={t("inputMode")}><button type="button" disabled={recording} aria-pressed={inputMode === "write"} aria-controls="written-input" onClick={()=>setInputMode("write")}>{t("writeMode")}</button><button type="button" aria-pressed={inputMode === "record"} aria-controls="recorded-input" onClick={()=>setInputMode("record")}>{t("recordMode")}</button></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="country">Country</Label><select id="country" value={country} onChange={(e) => changeCountry(e.target.value as "IN"|"BR"|"ZA")} className="min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm">{countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div><div className="space-y-1"><Label data-no-ui-translation htmlFor="language">{t("reportLanguage")}</Label><select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm">{languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
              <div id="written-input" hidden={inputMode !== "write"} className="space-y-2"><Label htmlFor="report">Describe the issue</Label><Textarea id="report" value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the issue, how long it has existed, and the outcome you are requesting." className="min-h-36 bg-background" /></div>
              <div id="recorded-input" hidden={inputMode !== "record"} className="rounded-lg border border-accent/20 bg-accent/5 p-4"><Button type="button" className="w-full sm:w-auto" variant={recording ? "secondary" : "accent"} onClick={requestRecording}>{recording ? <><Pause className="mr-2 h-4 w-4"/>Stop recording · {recordingSeconds}s</> : <><Mic className="mr-2 h-4 w-4"/>Record your report</>}</Button>{recording ? <div aria-label="Recording waveform" className="mt-4 flex h-8 items-center gap-1">{Array.from({ length: 20 }, (_, index) => <span key={index} className="w-1 animate-pulse rounded-full bg-accent" style={{ height: `${8 + ((index * 7) % 22)}px` }}/>)}</div> : null}{audioPreviewUrl ? <div className="mt-4 grid gap-3"><audio controls aria-label="Report audio preview" src={audioPreviewUrl} className="w-full"/><Button data-no-ui-translation size="sm" variant="ghost" className="w-fit" onClick={deleteAttachment}><RotateCcw className="mr-2 h-4 w-4"/>{t("deleteRecording")}</Button></div> : null}<label htmlFor="voice-evidence" className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-3 text-sm"><Upload className="mr-2 h-4 w-4"/>Upload an audio file</label><input id="voice-evidence" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg" className="sr-only" onChange={e=>{requestAttachment(e.target.files?.[0]);e.target.value="";}}/><p className="mt-3 text-sm text-muted-foreground">Audio is private. The original is preserved for supported transcription and translation.</p></div>
              <p data-no-ui-translation className="text-xs leading-relaxed text-muted-foreground">{t("modeHint")}{inputMode === "write" && audioPreviewUrl ? <span className="mt-1 block font-semibold">{t("savedAudio")}</span> : inputMode === "record" && text.trim() ? <span className="mt-1 block font-semibold">{t("savedText")}</span> : null}</p>
              <div className="intake-actions"><Button disabled={recording} className="w-full" onClick={goToLocation}>Continue to location <ArrowRight className="ml-2 h-4 w-4"/></Button></div>
            </> : null}
            {step === 2 ? <>
              <div className="space-y-2"><Label htmlFor="admin-area">Administrative area or landmark</Label><Input id="admin-area" value={adminHint} onChange={(e) => setAdminHint(e.target.value)} placeholder={`District, ward, or locality in ${countryName}`} aria-describedby="admin-area-help"/><p id="admin-area-help" className="text-sm text-muted-foreground">Required without browser location. Do not enter a house number or exact home address.</p></div>
              <div className="rounded-2xl border border-border bg-background p-4"><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold">{location ? "Approximate location added" : "No browser location added"}</p><p className="text-sm text-muted-foreground">{location ? "Precision is reduced before submission; coordinates are not shown as the primary location." : "Country selection never creates coordinates. Administrative-area text is enough to continue."}</p></div><Button type="button" variant="outline" onClick={requestLocation}><LocateFixed className="mr-2 h-4 w-4"/>Use approximate location</Button></div></div>
              <div className="rounded-2xl border border-border bg-background p-4"><Label htmlFor="evidence" className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-4 py-2.5"><Upload className="mr-2 h-4 w-4"/>Attach optional evidence</Label><input id="evidence" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,image/jpeg,image/png" className="sr-only" onChange={(e) => { requestAttachment(e.target.files?.[0]); e.target.value=""; }}/><p className="mt-2 break-words text-sm text-muted-foreground">JPG, PNG, or supported audio; maximum 10 MB. {attachmentName ? `Selected: ${attachmentName}` : "No attachment selected."}</p>{attachment && attachment.type.startsWith("image/") ? <p className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm"><Upload className="h-4 w-4"/>Image ready for private upload</p> : null}{attachment ? <Button data-no-ui-translation variant="ghost" size="sm" className="mt-3" onClick={deleteAttachment}>{t("removeAttachment")}</Button> : null}</div>
              <div className="intake-actions flex gap-2"><Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4"/>Back</Button><Button className="flex-1" onClick={goToReview}>Review report <ArrowRight className="ml-2 h-4 w-4"/></Button></div>
            </> : null}
            {step === 3 ? <><div className="grid gap-3 sm:grid-cols-2"><ReviewItem label="Country" value={countryName}/><ReviewItem label="Language" value={languages.find((item) => item.value === language)?.label ?? language}/><ReviewItem label="Administrative area" value={adminHint.trim() || "Approximate browser area"}/><ReviewItem label="Report" value={text.trim() || (attachment?.type.startsWith("audio/") ? "Voice recording" : "Attached evidence")}/><ReviewItem label="Attachment" value={attachmentName || "None"}/><ReviewItem label="Location precision" value={location ? "Reduced approximate area" : "Administrative area only; no coordinates"}/></div><label className="flex min-h-14 items-start gap-3 rounded-2xl border border-border bg-background p-4"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/><span><span className="font-semibold">I consent to CivicBridge processing this report.</span><span className="mt-1 block text-sm text-muted-foreground">Original content remains private; tracking stores only the request ID in this browser.</span></span></label>{createMutation.isPending ? <div aria-live="polite"><p className="mt-2 text-sm text-muted-foreground">{submissionPhase === "saving" ? "Saving report…" : "Uploading evidence…"}</p></div> : null}<div className="intake-actions flex gap-2"><Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4"/>Back</Button><Button className="flex-1" disabled={createMutation.isPending || recording} onClick={submit}>{createMutation.isPending ? <><RefreshCcw className="mr-2 h-4 w-4 animate-spin"/>Submitting</> : <><Send className="mr-2 h-4 w-4"/>Submit request</>}</Button></div></> : null}
          </CardContent>
        </Card>

        {activeId ? <Card aria-live="polite"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="info">Tracking {activeId.slice(0, 8)}</Badge><div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={() => void copyRequestId()}><Clipboard className="mr-2 h-4 w-4"/>Copy request ID</Button><Button variant="ghost" size="sm" onClick={clearTracking}>Track another request</Button></div></div><CardTitle>Request status</CardTitle><CardDescription>The request ID alone is saved in this browser so tracking can resume after refresh.</CardDescription><code className="break-all rounded-lg bg-muted px-3 py-2 text-xs">{activeId}</code></CardHeader><CardContent className="space-y-4">
          {statusQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-12"/><Skeleton className="h-24"/></div> : statusQuery.isError ? <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4"><CircleAlert className="h-5 w-5 text-warning"/><p className="mt-2 font-semibold">Status could not be loaded</p><p className="text-sm text-muted-foreground">{isApiError(statusQuery.error) ? statusQuery.error.message : "Check the connection and try again."}</p><Button variant="outline" size="sm" className="mt-3" onClick={resumePolling}>Retry</Button></div> : status ? <StatusReview status={status} correction={correction} setCorrection={setCorrection} confirm={() => confirmMutation.mutate()} confirming={confirmMutation.isPending} /> : null}
          {!polling && status && !TERMINAL_CITIZEN_STAGES.has(status.processing_stage) ? <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="font-semibold">Automatic checks paused</p><p className="text-sm text-muted-foreground">Processing is still underway. Resume when you are ready; the request ID is safe.</p><Button size="sm" variant="outline" className="mt-3" onClick={resumePolling}><RefreshCcw className="mr-2 h-4 w-4"/>Resume status checks</Button></div> : null}
        </CardContent></Card> : null}
      </div>
    </main>
  );
}

function StatusReview({ status, correction, setCorrection, confirm, confirming }: { status: CitizenStatus; correction: string; setCorrection: (value: string) => void; confirm: () => void; confirming: boolean }) {
  const timeline: Record<string, string[]> = { submitted:["Received"], transcribing:["Received","Transcribing"], translating:["Received","Transcribing","Translating"], normalizing:["Received","Transcribing","Translating","Normalizing"], matching:["Received","Transcribing","Translating","Normalizing","Matching related reports"], hotspot_aggregated:["Received","Transcribing","Translating","Normalizing","Matching related reports","Updating hotspot"], under_review:["Received","Transcribing","Translating","Normalizing","Ready for confirmation"] };
  const confirmed = timeline[status.processing_stage] ?? [stageLabel(status.processing_stage)];
  return <div className="space-y-4"><div aria-label="Backend-confirmed processing timeline" className="flex flex-wrap gap-2">{confirmed.map((stage, index) => <Badge key={`${stage}-${index}`} variant={index === confirmed.length - 1 ? "accent" : "success"}>{stage}</Badge>)}</div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Stage</p><p className="mt-2 font-semibold capitalize">{stageLabel(status.processing_stage)}</p></div><div className="rounded-2xl border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Category</p><p className="mt-2 font-semibold capitalize">{status.category ?? "Not supplied yet"}</p></div><div className="rounded-2xl border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Hotspot score</p><p className="mt-2 font-semibold">{status.hotspot_score ?? "Not supplied yet"}</p></div></div>
    {status.public_summary ? <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-accent"/>Review what we understood</div><p className="mt-3 text-sm leading-relaxed">{status.public_summary}</p><div className="mt-4 space-y-2"><Label htmlFor="correction">Correction or clarification (optional)</Label><Textarea id="correction" value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Explain anything the normalized summary or category got wrong."/><Button onClick={confirm} disabled={confirming}>{confirming ? "Confirming…" : correction.trim() ? "Submit correction and confirm" : "Confirm report"}</Button></div></div> : <div className="rounded-2xl border border-border bg-muted/30 p-4"><FileAudio className="h-5 w-5 text-accent"/><p className="mt-2 font-semibold">We’re preparing your summary</p><p className="text-sm text-muted-foreground">Your summary will appear here when it is ready. You can then check it and make corrections.</p></div>}
    {status.project_title ? <div className="rounded-2xl border border-success/30 bg-success/5 p-4"><ShieldCheck className="h-5 w-5 text-success"/><p className="mt-2 font-semibold">Linked development project: {status.project_title}</p>{status.project_status ? <p className="text-sm text-muted-foreground">Status: {stageLabel(status.project_status)}</p> : null}</div> : null}
  </div>;
}

function ReviewItem({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-border bg-background p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 break-words font-semibold">{value}</p></div>; }
