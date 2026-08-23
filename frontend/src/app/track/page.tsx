import type { Metadata } from "next";
import { SiteHeader } from "@/components/navigation/site-header";
import { TrackRequestShell } from "@/components/track/track-request-shell";

export const metadata: Metadata = { title: "Track a report | CivicBridge AI" };
export default function TrackPage() { return <><SiteHeader/><TrackRequestShell/></>; }
