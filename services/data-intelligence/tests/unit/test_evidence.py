from app.services.evidence import anonymize_summary, build_evidence_bundle


def test_anonymization_masks_contact_details():
    value = anonymize_summary("Contact person@example.com or +91 98765 43210 about flooding")
    assert "person@example.com" not in value
    assert "98765" not in value


def test_bundle_hash_is_reproducible_and_has_no_coordinates():
    hotspot = {"hotspot_id":"h","country_code":"IN","geography_id":"g","spatial_cell":"cell","category":"drainage",
        "request_count":1,"unique_request_count":1,"corroboration_count":0,"affected_population":10,"trend_30d":0,
        "need_score":50,"action_score":40,"evidence_confidence":0.7,"score_version":"v","calculated_at":"2026-08-20T00:00:00Z"}
    geography = {"geography_id":"g","country_code":"IN","admin1":"A","admin2":"B","locality":"C","spatial_cell":"cell",
        "confidence":0.8,"boundary_source":"src","boundary_version":"v","latitude":1,"longitude":2}
    members = [{"request_id":"r","summary":"Flooding; email me at person@example.com"}]
    enrichment = {"demographic":None,"infrastructure":None,"projects":[],"sources":[]}
    args=dict(hotspot=hotspot,geography=geography,members=members,components=[],enrichment=enrichment,bundle_version=1,
              created_at="2026-08-20T00:00:00Z",warnings=[])
    first = build_evidence_bundle(**args)
    second = build_evidence_bundle(**args)
    assert first == second
    assert "latitude" not in str(first[2]) and "longitude" not in str(first[2])
    assert "person@example.com" not in str(first[2])
