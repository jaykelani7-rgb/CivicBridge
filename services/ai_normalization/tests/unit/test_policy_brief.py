from services.ai_normalization.pipeline.policy_brief import PolicyBriefDraftAdapter


def test_ground_strips_ids_not_in_evidence_bundle():
    adapter = PolicyBriefDraftAdapter(use_mock=True)
    draft = {
        "title": "Test",
        "supporting_evidence_ids": ["src_population_42", "INVENTED_ID_NOT_IN_BUNDLE"],
        "confidence": 0.9,
    }
    grounded = adapter._ground(draft, valid_ids=["src_population_42", "cluster_drainage_42"])
    assert "INVENTED_ID_NOT_IN_BUNDLE" not in grounded["supporting_evidence_ids"]
    assert "src_population_42" in grounded["supporting_evidence_ids"]
    assert grounded["confidence"] <= 0.6  # confidence is downgraded when a citation was stripped
    assert grounded["missing_information"]  # a note explaining the removal was added


def test_ground_leaves_fully_supported_draft_untouched():
    adapter = PolicyBriefDraftAdapter(use_mock=True)
    draft = {
        "title": "Test",
        "supporting_evidence_ids": ["src_population_42"],
        "confidence": 0.9,
    }
    grounded = adapter._ground(dict(draft), valid_ids=["src_population_42", "cluster_drainage_42"])
    assert grounded["supporting_evidence_ids"] == ["src_population_42"]
    assert grounded["confidence"] == 0.9


def test_mock_draft_never_invents_evidence_ids():
    adapter = PolicyBriefDraftAdapter(use_mock=True)
    bundle = {"valid_evidence_ids": ["src_a", "src_b"], "summary": "Test hotspot."}
    draft = adapter.generate_draft("hs-1", "evb-1", bundle)
    assert set(draft["supporting_evidence_ids"]).issubset(set(bundle["valid_evidence_ids"]))
