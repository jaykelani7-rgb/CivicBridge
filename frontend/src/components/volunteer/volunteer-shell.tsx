"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, CheckCircle2, CircleAlert, FileAudio, LocateFixed, Mic, Pause, RefreshCcw, Send, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { convertRecordedAudioToWav } from "@/lib/media/wav";

const trackingKey = "civicbridge:request-id";
const countries = [{ code: "IN", name: "India", center: [26.9124, 75.7873] }, { code: "BR", name: "Brazil", center: [-22.9068, -43.1729] }, { code: "ZA", name: "South Africa", center: [-33.9249, 18.4241] }] as const;
const languages = [{ value: "en-IN", label: "English (India)" }, { value: "hi-IN", label: "Hindi" }, { value: "pt-BR", label: "Portuguese (Brazil)" }, { value: "en-ZA", label: "English (South Africa)" }];

function stageLabel(value?: string) { return value ? value.replaceAll("_", " ") : "not submitted"; }

export function VolunteerShell() {
  const reducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCount = useRef(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [country, setCountry] = useState<"IN" | "BR" | "ZA">("IN");
  const [language, setLanguage] = useState("en-IN");
  const [adminHint, setAdminHint] = useState("");
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [location, setLocation] = useState<ApproximateLocation>({ precision: "approximate", latitude: 26.9124, longitude: 75.7873 });
  const [attachment, setAttachment] = useState<File | Blob | null>(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [recording, setRecording] = useState(false);
  const [polling, setPolling] = useState(true);
  const [correction, setCorrection] = useState("");

  useEffect(() => () => { if (recordingTimeout.current) clearTimeout(recordingTimeout.current); const recorder = mediaRecorder.current; if (recorder) { recorder.onstop = null; if (recorder.state !== "inactive") recorder.stop(); } stream.current?.getTracks().forEach((track) => track.stop()); }, []);

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
      const payload: CreateCitizenRequest = adaptCitizenRequest({ channel: attachment?.type.startsWith("audio/") ? "web_voice" : "web_text", country_code: country, language_hint: language, location: { ...location, admin_hint: adminHint.trim() || undefined }, consentAccepted: consent, text: text.trim() || undefined });
      const receipt = await citizenApi.create(payload, crypto.randomUUID());
      if (attachment) await citizenApi.upload(receipt.request_id, attachment, attachmentName || "citizen-evidence.bin");
      return receipt;
    },
    onSuccess: async (receipt) => {
      window.localStorage.setItem(trackingKey, receipt.request_id);
      setRequestId(receipt.request_id); setPolling(true); pollCount.current = 0;
      await queryClient.invalidateQueries({ queryKey: ["citizen"] });
      toast.success(`Request accepted. Receipt ${receipt.receipt_id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!activeId) throw new Error("No request to confirm.");
      if (correction.trim()) await citizenApi.correct(activeId, { reason: "Citizen correction after normalization review", notes: correction.trim() });
      return citizenApi.confirm(activeId, { ...location, admin_hint: adminHint.trim() || undefined }, correction.trim() || undefined);
    },
    onSuccess: async () => { toast.success("Report confirmed. Processing will continue."); setCorrection(""); setPolling(true); pollCount.current = 0; await statusQuery.refetch(); },
    onError: (error) => toast.error(error.message),
  });

  const countryName = useMemo(() => countries.find((item) => item.code === country)?.name ?? country, [country]);

  function changeCountry(value: "IN" | "BR" | "ZA") {
    setCountry(value); const selected = countries.find((item) => item.code === value)!;
    setLocation({ precision: "approximate", latitude: selected.center[0], longitude: selected.center[1] });
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
        try { const wav = await convertRecordedAudioToWav(blob); setAttachment(wav); setAttachmentName("citizen-recording.wav"); toast.success("Recording ready for review and upload."); }
        catch { toast.error("This browser could not prepare the recording. Upload a WAV, MP3, M4A, or OGG file instead."); }
        finally { setRecording(false); }
      };
      recorder.start(500); setRecording(true); recordingTimeout.current = setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 60_000);
    } catch { toast.error("Microphone permission was not granted. You can upload an audio file."); }
  }

  function requestLocation() {
    if (!navigator.geolocation) { toast.error("Browser geolocation is unavailable."); return; }
    navigator.geolocation.getCurrentPosition((position) => { setLocation({ precision: "approximate", latitude: position.coords.latitude, longitude: position.coords.longitude, admin_hint: adminHint || undefined }); toast.success("Approximate location added."); }, () => toast.error("Location permission was not granted."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  function resumePolling() { pollCount.current = 0; setPolling(true); void statusQuery.refetch(); }
  function clearTracking() { if (typeof window !== "undefined") window.localStorage.removeItem(trackingKey); setRequestId(null); queryClient.setQueryData(["citizen", "saved-tracking"], null); setPolling(false); }

  const status = statusQuery.data;
  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8f5ef_0%,#f2ede3_54%,#ece5d7_100%)] px-4 py-5 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <motion.header initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-border bg-card/95 p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">CivicBridge Citizen Portal</p><h1 className="mt-1 font-heading text-3xl font-black">Public Infrastructure Request</h1></div><Badge variant="success">Public submission</Badge></div>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Submit text or a real voice recording. Google Speech-to-Text, Translation, and Gemini process supported requests in the canonical backend.</p>
          <Button asChild variant="ghost" size="sm" className="mt-3"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/>Back home</Link></Button>
        </motion.header>

        <Card><CardHeader><Badge variant="accent" className="w-fit">Request details</Badge><CardTitle>Tell us what public infrastructure needs attention</CardTitle><CardDescription>Only approximate location is requested. Browser location is optional and activated only by you.</CardDescription></CardHeader>
          <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="country">Country</Label><select id="country" value={country} onChange={(e) => changeCountry(e.target.value as "IN"|"BR"|"ZA")} className="h-11 w-full rounded-lg border border-border bg-background px-3">{countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="language">Language</Label><select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} className="h-11 w-full rounded-lg border border-border bg-background px-3">{languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="admin-area">Administrative area or landmark</Label><Input id="admin-area" value={adminHint} onChange={(e) => setAdminHint(e.target.value)} placeholder={`District, ward, or locality in ${countryName}`} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="report">Written report</Label><Textarea id="report" value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the issue, how long it has existed, and the outcome you are requesting." className="min-h-32" /></div>
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:col-span-2 sm:flex-row">
              <Button type="button" variant={recording ? "secondary" : "outline"} className="whitespace-normal" onClick={() => void toggleRecording()}><span aria-live="polite">{recording ? <><Pause className="mr-2 inline h-4 w-4"/>Stop recording</> : <><Mic className="mr-2 inline h-4 w-4"/>Record voice</>}</span></Button>
              <div className="min-w-0 flex-1"><Label htmlFor="evidence" className="inline-flex max-w-full cursor-pointer items-center whitespace-normal rounded-lg border border-border px-4 py-2.5"><Upload className="mr-2 h-4 w-4 shrink-0"/>Upload audio, photo, or evidence</Label><input id="evidence" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,image/jpeg,image/png" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setAttachment(file); setAttachmentName(file.name); } }} /><p className="mt-2 break-words text-xs text-muted-foreground">One private attachment, maximum 10 MB. {attachmentName && `Selected: ${attachmentName}`}</p></div>
            </div>
            <div className="min-w-0 rounded-2xl border border-border bg-background p-4 sm:col-span-2"><Button type="button" variant="ghost" className="h-auto whitespace-normal" onClick={requestLocation}><LocateFixed className="mr-2 h-4 w-4 shrink-0"/>Use my approximate browser location</Button><p className="mt-2 break-words text-xs text-muted-foreground">Current approximate coordinates: {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}</p></div>
            <label className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4 sm:col-span-2"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4"/><span><span className="font-semibold">I consent to CivicBridge processing this report.</span><span className="mt-1 block text-sm text-muted-foreground">The backend stores original content privately and returns a public-safe tracking status.</span></span></label>
            <Button className="h-12 sm:col-span-2" disabled={createMutation.isPending || recording} onClick={() => createMutation.mutate()}>{createMutation.isPending ? <><RefreshCcw className="mr-2 h-4 w-4 animate-spin"/>Uploading and submitting</> : <><Send className="mr-2 h-4 w-4"/>Submit request</>}</Button>
          </CardContent>
        </Card>

        {activeId ? <Card aria-live="polite"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="info">Tracking {activeId.slice(0, 8)}</Badge><Button variant="ghost" size="sm" onClick={clearTracking}>Track another request</Button></div><CardTitle>Request status</CardTitle><CardDescription>The request ID alone is saved in this browser so tracking can resume after refresh.</CardDescription></CardHeader><CardContent className="space-y-4">
          {statusQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-12"/><Skeleton className="h-24"/></div> : statusQuery.isError ? <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4"><CircleAlert className="h-5 w-5 text-warning"/><p className="mt-2 font-semibold">Status could not be loaded</p><p className="text-sm text-muted-foreground">{isApiError(statusQuery.error) ? statusQuery.error.message : "Check the connection and try again."}</p><Button variant="outline" size="sm" className="mt-3" onClick={resumePolling}>Retry</Button></div> : status ? <StatusReview status={status} correction={correction} setCorrection={setCorrection} confirm={() => confirmMutation.mutate()} confirming={confirmMutation.isPending} /> : null}
          {!polling && status && !TERMINAL_CITIZEN_STAGES.has(status.processing_stage) ? <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="font-semibold">Automatic checks paused</p><p className="text-sm text-muted-foreground">Processing is still underway. Resume when you are ready; the request ID is safe.</p><Button size="sm" variant="outline" className="mt-3" onClick={resumePolling}><RefreshCcw className="mr-2 h-4 w-4"/>Resume status checks</Button></div> : null}
        </CardContent></Card> : null}
      </div>
    </main>
  );
}

function StatusReview({ status, correction, setCorrection, confirm, confirming }: { status: CitizenStatus; correction: string; setCorrection: (value: string) => void; confirm: () => void; confirming: boolean }) {
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Stage</p><p className="mt-2 font-semibold capitalize">{stageLabel(status.processing_stage)}</p></div><div className="rounded-2xl border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Category</p><p className="mt-2 font-semibold capitalize">{status.category ?? "Not supplied yet"}</p></div><div className="rounded-2xl border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Hotspot score</p><p className="mt-2 font-semibold">{status.hotspot_score ?? "Not supplied yet"}</p></div></div>
    {status.public_summary ? <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-accent"/>AI-normalized public summary</div><p className="mt-3 text-sm leading-relaxed">{status.public_summary}</p><div className="mt-4 space-y-2"><Label htmlFor="correction">Correction or clarification (optional)</Label><Textarea id="correction" value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Explain anything the normalized summary or category got wrong."/><Button onClick={confirm} disabled={confirming}>{confirming ? "Confirming…" : correction.trim() ? "Submit correction and confirm" : "Confirm report"}</Button></div></div> : <div className="rounded-2xl border border-border bg-muted/30 p-4"><FileAudio className="h-5 w-5 text-accent"/><p className="mt-2 font-semibold">Normalization is still processing</p><p className="text-sm text-muted-foreground">The review controls will appear only when the backend supplies a public summary. No summary or score is fabricated.</p></div>}
    {status.project_title ? <div className="rounded-2xl border border-success/30 bg-success/5 p-4"><ShieldCheck className="h-5 w-5 text-success"/><p className="mt-2 font-semibold">Linked development project: {status.project_title}</p>{status.project_status ? <p className="text-sm text-muted-foreground">Status: {stageLabel(status.project_status)}</p> : null}</div> : null}
  </div>;
}
