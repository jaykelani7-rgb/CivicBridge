# Cape Town official-data pilot assessment

The attempted geography is `ZA-WC-CPT-W15`, the **synthetic demonstration** Ward 15 geography in the existing Cape Town pack. No official measurements have been inserted into its hotspot, score, or evidence bundle. The assessment metadata is in [cape-town-source-assessment.json](cape-town-source-assessment.json).

The three publisher sources considered are the [City's Census 2022 page](https://www.capetown.gov.za/Work%20and%20business/Education-and-research-materials/Data-statistics-and-research/Cape-Town-census), the [2024 household survey](https://household-survey.capetown.gov.za/), and [2025/26–2027/28 budget Annexure A](https://resource.capetown.gov.za/documentcentre/Documents/Financial%20documents/Budget2526_AnnexureA.pdf). The census summary is at metro level; the water survey presents suburb indicators; the budget describes ward allocations but a Ward 15 water-project row has not been extracted and validated. The existing demo boundary version does not establish correspondence to the publishers' statistical areas. Census 2022 is also beyond this pilot's three-year freshness rule. The City's [open-data terms](https://www.capetown.gov.za/General/Terms-of-use-open-data) apply to its open-data portal; these particular web and document downloads require a separate reuse review. Publisher pages were checked on 2026-09-30. Their actual values are **not** copied into CivicBridge.

Run the local assessment with:

```sh
python3 scripts/official_pilot.py
```

It exits with status 1 and lists each blocker. Once an operator has lawful, ward-matched source extracts, a verified boundary crosswalk, reference-period reconciliation, and cleared reuse terms, update the catalog and put normalized CSV files in `data/raw/cape-town-pilot/`. Each CSV requires `source_id,geography_id,boundary_version,reference_year,value`. Validate and produce a local, **unverified** normalized file with:

```sh
python3 scripts/official_pilot.py --input-dir data/raw/cape-town-pilot --output data/raw/cape-town-pilot/validated.json
```

The output is not an automatic official-data approval or BigQuery load. A reviewer must examine raw checksums, transformation notes, exact geography codes, publisher rights, and measurement methods before creating the existing versioned [BigQuery ingestion manifest](../../services/data-intelligence/datasets/manifests/manifest.schema.json) and using the repository's ingestion command. Missing indicators must remain missing; city or suburb figures cannot be assigned to a ward by name alone.

The deterministic score uses an eligible infrastructure-gap field in need scoring, strategic alignment and delivery readiness in action scoring, and an existing-coverage penalty. `test_matched_infrastructure_and_investment_evidence_changes_priority` demonstrates those effects with explicitly synthetic test inputs. It is not evidence that the Cape Town data has been joined or ingested.
