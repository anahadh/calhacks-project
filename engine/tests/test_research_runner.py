"""The runner must be honest: CUH exploratory, HSE/BL unsupported, never fitted."""

from sim_core import research_runner as runner


def test_run_default_statuses_are_honest():
    report = runner.run_default(seeds=range(4))  # small seed set keeps the test fast

    # HSE / BL checks are unsupported with concrete evidence gaps, never "passed".
    for key in ("check_1_hse_calibration", "check_2_right_reasons", "check_5_out_of_sample"):
        assert report[key]["status"] == "unsupported"
    assert report["check_1_hse_calibration"]["evidence_gaps"]
    assert report["check_5_out_of_sample"]["evidence_gaps"]
    assert report["check_1_hse_calibration"]["privileged_accounts_by_13_may"]["status"] == "insufficient_inventory"

    # CUH checks run, labelled exploratory, with full serialization.
    c3 = report["check_3_robustness"]
    assert c3["status"] == "exploratory"
    assert len(c3["seeds"]) == 4 and len(c3["trial_keys"]) == 4
    assert c3["config"] and c3["assumptions"]
    assert c3["medical_devices_encrypted"] == 0
    # "Radiology" has no exact match or fixed alias -> reported, not guessed.
    assert "Radiology" in c3["unresolved_calibration_labels"]
    assert "Radiotherapy" in c3["shares"]

    c4 = report["check_4_cuh_press_holdout"]
    assert c4["status"] == "exploratory"
    cork = [c for c in c4["comparisons"] if c["site"] == "Cork University Hospital"]
    assert cork and all("predicted" in c for c in cork)
    # Neighbouring hospitals in the CSV are excluded, not scored.
    assert any(c["status"] == "out_of_scope" for c in c4["comparisons"])


def test_check_6_national_cut_defeats_the_local_plan():
    report = runner.run_default(seeds=range(1))
    c6 = report["check_6_agents_plan_known_limit"]
    assert c6["status"] == "passed"
    assert c6["radiology"]["state"] in {"down", "paper"}
    assert c6["email"]["state"] in {"down", "paper"}


def test_no_check_is_ever_reported_passed_for_hse_or_british_library():
    report = runner.run_default(seeds=range(2))
    for key in ("check_1_hse_calibration", "check_2_right_reasons", "check_5_out_of_sample"):
        assert report[key]["status"] not in {"passed", "exploratory"}
