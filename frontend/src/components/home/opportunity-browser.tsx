"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Filter, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { analyticsAttributes, trackEvent } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hotspots, type Hotspot } from "./home-data";

type SectorFilter = Hotspot["sector"] | "All";
type CountryFilter = Hotspot["country"] | "All";
type UrgencyFilter = Hotspot["urgency"] | "All";

const sectorOptions: SectorFilter[] = [
  "All",
  "Water",
  "Sanitation",
  "Roads",
  "Drainage",
  "Electricity",
  "Connectivity",
  "Waste",
];

const countryOptions: CountryFilter[] = ["All", "India", "Brazil", "South Africa"];
const urgencyOptions: UrgencyFilter[] = [
  "All",
  "Critical",
  "High",
  "Moderate",
];

function filterCount<T extends string>(
  items: Hotspot[],
  getValue: (item: Hotspot) => T,
  value: T | "All",
) {
  if (value === "All") {
    return items.length;
  }

  return items.filter((item) => getValue(item) === value).length;
}

function FilterGroup<T extends string>({
  title,
  options,
  selected,
  onSelect,
  countFor,
}: {
  title: string;
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  countFor: (value: T) => number;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option === selected;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-background text-foreground hover:border-accent/50 hover:bg-accent/5",
              )}
            >
              <span>{option}</span>
              <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                {countFor(option)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HotspotBrowser() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<SectorFilter>("All");
  const [country, setCountry] = useState<CountryFilter>("All");
  const [urgency, setUrgency] = useState<UrgencyFilter>("All");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();

    return hotspots.filter((item) => {
      const matchesQuery =
        !normalized ||
        [item.title, item.agency, item.location, item.summary, item.sector]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesSector = sector === "All" || item.sector === sector;
      const matchesCountry = country === "All" || item.country === country;
      const matchesUrgency =
        urgency === "All" || item.urgency === urgency;

      return matchesQuery && matchesSector && matchesCountry && matchesUrgency;
    });
  }, [sector, urgency, deferredQuery, country]);

  function clearFilters() {
    setQuery("");
    setSector("All");
    setCountry("All");
    setUrgency("All");
  }

  const filters = (
    <div className="space-y-5 rounded-[24px] border border-border bg-card p-5 shadow-sm">
      <div className="space-y-2">
        <label
          htmlFor="hotspot-search"
          className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Search hotspots
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="hotspot-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-11"
            placeholder="Search by sector, agency, or location"
          />
        </div>
      </div>

      <FilterGroup
        title="Sector"
        options={sectorOptions}
        selected={sector}
        onSelect={setSector}
        countFor={(value) => filterCount(hotspots, (item) => item.sector, value)}
      />
      <FilterGroup
        title="Country"
        options={countryOptions}
        selected={country}
        onSelect={setCountry}
        countFor={(value) => filterCount(hotspots, (item) => item.country, value)}
      />
      <FilterGroup
        title="Urgency"
        options={urgencyOptions}
        selected={urgency}
        onSelect={setUrgency}
        countFor={(value) => filterCount(hotspots, (item) => item.urgency, value)}
      />

      <Button type="button" variant="outline" onClick={clearFilters} className="w-full">
        Clear filters
      </Button>
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="hidden xl:block">{filters}</div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[24px] border border-border bg-card/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Results
            </p>
            <p className="text-lg font-semibold text-foreground">
              {filtered.length} active hotspots
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="xl:hidden"
              onClick={() => setMobileFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
            </Button>
            {(query || sector !== "All" || country !== "All" || urgency !== "All") && (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Reset all
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {mobileFiltersOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="xl:hidden"
            >
              {filters}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="grid gap-4">
          {filtered.map((hotspot) => (
            <Card key={hotspot.id} className="overflow-hidden">
              <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{hotspot.sector}</Badge>
                    <Badge variant="accent">{hotspot.urgency} urgency</Badge>
                    <Badge variant="info">{hotspot.country}</Badge>
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">{hotspot.title}</CardTitle>
                    <p className="text-base text-muted-foreground">{hotspot.agency}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{hotspot.date}</p>
                  <p>{hotspot.reports} reports</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-accent" />
                    {hotspot.location}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Filter className="h-4 w-4 text-secondary" />
                    {hotspot.urgency}
                  </span>
                </div>
                <p className="max-w-3xl text-base text-foreground/90">
                  {hotspot.summary}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    onClick={() =>
                      trackEvent({
                        event: "hotspot_view_clicked",
                        category: "analyst",
                        label: hotspot.title,
                        destination: "/command-center",
                      })
                    }
                    {...analyticsAttributes({
                      event: "hotspot_view_clicked",
                      category: "analyst",
                      label: hotspot.title,
                      destination: "/command-center",
                    })}
                  >
                    <a href="/command-center">View in analyst console</a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    onClick={() =>
                      trackEvent({
                        event: "hotspot_intake_clicked",
                        category: "citizen",
                        label: hotspot.title,
                        destination: "/volunteer",
                      })
                    }
                    {...analyticsAttributes({
                      event: "hotspot_intake_clicked",
                      category: "citizen",
                      label: hotspot.title,
                      destination: "/volunteer",
                    })}
                  >
                    <a href="/volunteer">Submit feedback for zone</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
