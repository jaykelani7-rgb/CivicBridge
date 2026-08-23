import type { Metadata } from "next";
import { MobileMoreMenu } from "@/components/navigation/mobile-more-menu";
import { SiteHeader } from "@/components/navigation/site-header";

export const metadata: Metadata = { title: "More | CivicBridge AI" };
export default function MorePage() { return <><SiteHeader/><MobileMoreMenu/></>; }
