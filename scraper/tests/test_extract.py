from mp_tesla import extract, infer


def test_trim_base_and_highland_flag():
    text = "Tesla Model 3 Achterwielaandrijving / RWD (Highland) Pearl White"
    assert extract.detect_highland(text)
    # detect_trim returns the BASE trim; the refresh suffix is added by record.py.
    assert extract.detect_trim(text) == "RWD"
    assert extract.detect_drivetrain(text) == "RWD"


def test_juniper_keyword():
    assert extract.detect_juniper("Tesla Model Y Juniper Long Range")
    assert not extract.detect_juniper("Tesla Model Y Long Range 2022")


def test_trim_long_range_awd():
    text = "Model Y Long Range Dual Motor AWD, panoramadak"
    trim = extract.detect_trim(text)
    assert "Long Range" in trim
    assert extract.detect_drivetrain(text) == "AWD"


def test_performance():
    assert extract.detect_trim("Model 3 Performance uitvoering") == "Performance"


def test_fsd_vs_eap_vs_basic():
    assert extract.detect_autopilot_package("incl. Full Self-Driving (FSD)") == "fsd"
    assert extract.detect_autopilot_package("met Enhanced Autopilot pakket") == "eap"
    assert extract.detect_autopilot_package("standaard Autopilot") == "basic"


def test_soh_within_context_only():
    assert extract.detect_soh("batterijgezondheid 94% gemeten") == 94.0
    # A stray percentage far from any battery word must be ignored.
    assert extract.detect_soh("financiering vanaf 4,9% rente per jaar") is None


def test_hw_mention():
    assert extract.detect_hw_mention("voorzien van Hardware 4 (HW4)") == "HW4"
    assert extract.detect_hw_mention("nog de oude AP3 computer") == "HW3"
    assert extract.detect_hw_mention("geen computer vermeld") is None


def test_color_normalise():
    assert extract.normalise_color("Pearl White Multi-Coat") == "White"
    assert extract.normalise_color("Zwart") == "Black"


def test_hw_inference_model3_highland():
    res = infer.infer_hw_platform("Model 3", 2024, is_highland=True, explicit_mention=None)
    assert res == {"value": "HW4", "source": "inferred", "confidence": "high"}


def test_hw_inference_model3_pre_highland():
    res = infer.infer_hw_platform("Model 3", 2020, is_highland=False, explicit_mention=None)
    assert res["value"] == "HW3" and res["source"] == "inferred"


def test_hw_inference_explicit_wins():
    res = infer.infer_hw_platform("Model 3", 2019, is_highland=False, explicit_mention="HW4")
    assert res == {"value": "HW4", "source": "explicit", "confidence": "high"}


def test_hw_inference_model_y_boundary():
    assert infer.infer_hw_platform("Model Y", 2021, False, None)["confidence"] == "high"
    assert infer.infer_hw_platform("Model Y", 2024, False, None)["value"] == "HW4"
    assert infer.infer_hw_platform("Model Y", 2023, False, None)["confidence"] == "low"


def test_performance_guarded_off():
    text = "Tesla Model 3 2019 RWD, sportieve performance velgen"
    assert extract.detect_trim(text, allow_performance=False) != "Performance"
    assert extract.detect_trim(text, allow_performance=True) == "Performance"


def test_price_from_text_keyword():
    assert extract.extract_price_from_text("Prijs: €36.490,- incl. BTW") == 36490
    assert extract.extract_price_from_text("Vraagprijs € 24.950") == 24950


def test_price_from_text_ignores_lease_and_newprice():
    txt = "Lease vanaf €299 per maand. Nieuwprijs was €58.000. Vraagprijs €31.500."
    assert extract.extract_price_from_text(txt) == 31500


def test_price_from_text_single_neutral_amount():
    assert extract.extract_price_from_text("Mooie Tesla, € 27.900 en rijklaar") == 27900


def test_price_from_text_ambiguous_returns_none():
    # Two unlabeled amounts -> too ambiguous to trust.
    assert extract.extract_price_from_text("zie € 22.000 of € 45.000") is None


def test_price_from_text_below_floor_ignored():
    assert extract.extract_price_from_text("slechts €299 per maand") is None


def test_tow_hitch_positive_and_negated():
    from mp_tesla import extract
    assert extract.detect_tow_hitch("Nederlandse auto, afneembare trekhaak, etc")
    assert extract.detect_tow_hitch("Model Y Long Range Trekhaak Premium interieur")  # Tesla option
    assert extract.detect_tow_hitch("incl. tow bar")
    assert not extract.detect_tow_hitch("geen trekhaak aanwezig")
    assert not extract.detect_tow_hitch("trekhaak voorbereiding aanwezig")
    assert not extract.detect_tow_hitch("mooie auto zonder verdere opties")
