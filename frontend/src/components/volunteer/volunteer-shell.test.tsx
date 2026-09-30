import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicLocaleProvider } from "@/components/providers/public-locale-provider";
import { citizenApi } from "@/lib/api/citizen";
import { VolunteerShell } from "./volunteer-shell";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/volunteer" }));

vi.mock("@/lib/media/wav", () => ({ convertRecordedAudioToWav: vi.fn().mockResolvedValue(new Blob(["wav"], {type:"audio/wav"})) }));
let serial = 0;
beforeEach(() => {
  vi.stubGlobal("MediaRecorder", class {
    state="inactive"; mimeType="audio/webm";
    ondataavailable: ((event:{data:Blob})=>void)|null=null;
    onstop: (()=>void)|null=null;
    start() {this.state="recording";}
    stop() {this.state="inactive";this.ondataavailable?.({data:new Blob(["audio"])});this.onstop?.();}
  });
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  URL.createObjectURL=vi.fn(()=>`blob:audio-${++serial}`); URL.revokeObjectURL=vi.fn();
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();window.localStorage.clear();});

function mount() { return render(<QueryClientProvider client={new QueryClient()}><PublicLocaleProvider><VolunteerShell/></PublicLocaleProvider></QueryClientProvider>); }

describe("Citizen Portal accessibility", () => {
  it("preserves written text and recorded audio across modes and steps, with explicit replacement and deletion", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Describe the issue"),{target:{value:"Blocked drain beside the school"}});
    fireEvent.click(screen.getByRole("button",{name:"Record"}));
    fireEvent.click(screen.getByRole("button",{name:"Record your report"}));
    await screen.findByRole("button",{name:/Stop recording/});
    fireEvent.click(screen.getByRole("button",{name:/Stop recording/}));
    await waitFor(()=>expect(document.querySelector("audio")).toHaveAttribute("src",expect.stringMatching(/^blob:audio-/)));
    const original=document.querySelector("audio")!.getAttribute("src");
    fireEvent.click(screen.getByRole("button",{name:"Write"}));
    expect(screen.getByLabelText("Describe the issue")).toHaveValue("Blocked drain beside the school");
    fireEvent.click(screen.getByRole("button",{name:/Continue to location/}));
    fireEvent.change(screen.getByLabelText("Administrative area or landmark"),{target:{value:"Ward 42"}});
    fireEvent.click(screen.getByRole("button",{name:/Review report/}));
    expect(screen.getByText("citizen-recording.wav")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Back"}));
    fireEvent.click(screen.getByRole("button",{name:"Back"}));
    fireEvent.click(screen.getByRole("button",{name:"Record"}));
    expect(document.querySelector("audio")).toHaveAttribute("src",original);
    fireEvent.click(screen.getByRole("button",{name:"Record your report"}));
    expect(screen.getByText("Replace the current attachment?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Keep current attachment"}));
    expect(document.querySelector("audio")).toHaveAttribute("src",original);
    fireEvent.click(screen.getByRole("button",{name:"Delete recording"}));
    expect(document.querySelector("audio")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Write"}));
    expect(screen.getByLabelText("Describe the issue")).toHaveValue("Blocked drain beside the school");
  });

  it("requires an explicit choice before replacing a saved audio file", () => {
    mount(); fireEvent.click(screen.getByRole("button",{name:"Record"}));
    const input=document.querySelector<HTMLInputElement>("#voice-evidence")!;
    fireEvent.change(input,{target:{files:[new File(["original"],"original.wav",{type:"audio/wav"})]}});
    const original=document.querySelector("audio")!.getAttribute("src");
    fireEvent.change(input,{target:{files:[new File(["replacement"],"replacement.wav",{type:"audio/wav"})]}});
    expect(document.querySelector("audio")).toHaveAttribute("src",original);
    fireEvent.click(screen.getByRole("button",{name:"Replace attachment"}));
    expect(document.querySelector("audio")!.getAttribute("src")).not.toBe(original);
  });

  it("uses a three-step flow and country changes never create location", () => {
    render(<QueryClientProvider client={new QueryClient()}><PublicLocaleProvider><VolunteerShell/></PublicLocaleProvider></QueryClientProvider>);
    expect(screen.getByRole("heading", { name: /What needs attention\?/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
    expect(screen.getByLabelText("Describe the issue")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "BR" } });
    fireEvent.change(screen.getByLabelText("Describe the issue"), { target: { value: "Blocked public drain" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue to location/i }));
    expect(screen.getByText("No browser location added")).toBeInTheDocument();
    expect(screen.getByText(/Country selection never creates coordinates/i)).toBeInTheDocument();
  });

  it("uploads a voice report and supporting photo without replacing either", async () => {
    const created = vi.spyOn(citizenApi, "create").mockResolvedValue({request_id:"request-1", status:"awaiting_media", receipt_id:"RCT-1", message:"Accepted", submitted_at:"2026-09-30T00:00:00Z"});
    const mediaReceipt = {request_id:"request-1", media_ref:"private://media", filename:"saved", size_bytes:3, status:"uploaded"};
    const uploaded = vi.spyOn(citizenApi, "upload").mockResolvedValueOnce(mediaReceipt).mockRejectedValueOnce(new Error("Upload unavailable")).mockResolvedValue(mediaReceipt);
    vi.spyOn(citizenApi, "status").mockResolvedValue({request_id:"request-1", channel:"web_voice", country_code:"IN", submitted_at:"2026-09-30T00:00:00Z", processing_stage:"submitted", public_summary:null, category:null, hotspot_score:null, project_title:null, project_status:null, hotspot_id:null, recommendation_id:null, project_id:null, pii_masked:true});
    mount();
    fireEvent.click(screen.getByRole("button",{name:"Record"}));
    fireEvent.change(document.querySelector<HTMLInputElement>("#voice-evidence")!,{target:{files:[new File(["voice"],"voice.wav",{type:"audio/wav"})]}});
    fireEvent.click(screen.getByRole("button",{name:/Continue to location/}));
    fireEvent.change(screen.getByLabelText("Administrative area or landmark"),{target:{value:"Ward 42"}});
    fireEvent.change(document.querySelector<HTMLInputElement>("#evidence")!,{target:{files:[new File(["photo"],"drain.jpg",{type:"image/jpeg"})]}});
    expect(screen.getByText(/Selected: drain.jpg/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Review report/}));
    expect(screen.getByText("voice.wav")).toBeInTheDocument();
    expect(screen.getByText("drain.jpg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button",{name:"Submit request"}));
    await waitFor(()=>expect(uploaded).toHaveBeenCalledTimes(2));
    await screen.findByText("Upload unavailable");
    expect(window.localStorage.getItem("civicbridge:request-id")).toBe("request-1");
    fireEvent.click(screen.getByRole("button",{name:"Submit request"}));
    await waitFor(()=>expect(uploaded).toHaveBeenCalledTimes(3));
    expect(created.mock.calls[0][0].channel).toBe("web_voice");
    expect(created.mock.calls[0][1]).toBe(created.mock.calls[1][1]);
    expect(uploaded.mock.calls.map((call)=>call[2])).toEqual(["voice.wav","drain.jpg","drain.jpg"]);
  });
});
