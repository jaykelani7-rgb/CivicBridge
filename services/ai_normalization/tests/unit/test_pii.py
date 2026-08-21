from services.ai_normalization.pipeline.pii import merge_pii_flags, scan_and_mask


def test_scan_and_mask_detects_phone():
    text = "Please call me back at 98765 43210 to discuss."
    masked, flags = scan_and_mask(text)
    assert "phone" in flags
    assert "98765 43210" not in masked
    assert "[REDACTED_PHONE]" in masked


def test_scan_and_mask_ignores_short_ward_numbers():
    text = "The drain outside Ward 42 has been overflowing."
    masked, flags = scan_and_mask(text)
    assert "phone" not in flags
    assert masked == text


def test_scan_and_mask_detects_email():
    text = "Please reply to joao.silva@example.com with an update."
    masked, flags = scan_and_mask(text)
    assert "email" in flags
    assert "joao.silva@example.com" not in masked


def test_scan_and_mask_detects_person_name():
    text = "My name is Thandiwe Nkosi and our clinic has no staff."
    masked, flags = scan_and_mask(text)
    assert "person_name" in flags
    assert "Thandiwe Nkosi" not in masked


def test_scan_and_mask_detects_exact_home_reference():
    text = "The drain outside house no. 42B has been overflowing for a week."
    masked, flags = scan_and_mask(text)
    assert "exact_home" in flags
    assert "42B" not in masked


def test_scan_and_mask_returns_none_flag_for_clean_text():
    text = "There is no clean drinking water in our village, please help."
    masked, flags = scan_and_mask(text)
    assert flags == set()
    assert masked == text


def test_merge_pii_flags_dedupes_and_sorts():
    merged = merge_pii_flags(["phone"], ["email", "phone"], ["none"])
    assert merged == ["email", "phone"]


def test_merge_pii_flags_returns_none_when_nothing_found():
    assert merge_pii_flags(["none"], [], ["none"]) == ["none"]


def test_merge_pii_flags_ignores_unknown_flags():
    assert merge_pii_flags(["not_a_real_flag"], ["none"]) == ["none"]
