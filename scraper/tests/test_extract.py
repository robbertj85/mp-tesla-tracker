from mp_tesla import extract, infer


def test_trim_highland_rwd():
    text = "Tesla Model 3 Achterwielaandrijving / RWD (Highland) Pearl White"
    assert extract.detect_highland(text)
    assert extract.detect_trim(text) == "RWD (Highland)"
    assert extract.detect_drivetrain(text) == "RWD"


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
