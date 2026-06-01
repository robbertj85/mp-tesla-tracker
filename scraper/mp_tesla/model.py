"""Price regression + fair-price estimation.

Two models:
  * Ridge linear model with hand-rolled encoding. Used for the per-listing
    predicted "fair price" AND exported so the Next.js estimator reproduces the
    exact same prediction client-side (no Python backend at request time).
  * HistGradientBoostingRegressor: trained only to report a stronger accuracy
    benchmark and feature importances (insight), not used for the shown numbers.

Everything degrades gracefully on small / sparse data.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold, cross_val_predict

log = logging.getLogger(__name__)

NUMERIC_FEATURES = ["age", "mileage_km", "power_hp", "range_km"]
CATEGORICAL_FEATURES = ["model", "trim", "drivetrain", "hw_platform", "fsd",
                        "color", "condition"]
TARGET = "price_eur"


def _frame(records: list[dict], run_year: int) -> pd.DataFrame:
    rows = []
    for r in records:
        if not r.get("active", True):
            continue
        if r.get("price_eur") is None or r.get("year") is None:
            continue
        if r.get("mileage_km") is None:
            continue
        rows.append({
            "id": r["id"],
            "age": max(0, run_year - r["year"]),
            "mileage_km": r["mileage_km"],
            "power_hp": r.get("power_hp"),
            "range_km": r.get("range_km"),
            "model": r.get("model") or "unknown",
            "trim": r.get("trim") or "unknown",
            "drivetrain": r.get("drivetrain") or "unknown",
            "hw_platform": r.get("hw_platform") or "unknown",
            "fsd": "yes" if r.get("fsd") else "no",
            "color": r.get("color") or "unknown",
            "condition": r.get("condition") or "unknown",
            "price_eur": r["price_eur"],
        })
    return pd.DataFrame(rows)


def _encode(df: pd.DataFrame):
    """Manual encoding -> (matrix X, spec). spec lets JS reproduce predictions."""
    spec = {"numeric": {}, "categorical": {}, "columns": []}
    cols = []

    # Numerics: median-impute then standardize.
    for feat in NUMERIC_FEATURES:
        vals = pd.to_numeric(df[feat], errors="coerce")
        median = float(vals.median()) if vals.notna().any() else 0.0
        vals = vals.fillna(median)
        mean = float(vals.mean())
        std = float(vals.std(ddof=0)) or 1.0
        spec["numeric"][feat] = {"median": median, "mean": mean, "std": std}
        cols.append(((vals - mean) / std).to_numpy())
        spec["columns"].append(f"num::{feat}")

    # Categoricals: one-hot (every observed value gets a column).
    for feat in CATEGORICAL_FEATURES:
        values = sorted(df[feat].fillna("unknown").astype(str).unique())
        spec["categorical"][feat] = values
        for val in values:
            cols.append((df[feat].astype(str) == val).astype(float).to_numpy())
            spec["columns"].append(f"cat::{feat}::{val}")

    X = np.column_stack(cols) if cols else np.empty((len(df), 0))
    return X, spec


def _linear_export(spec: dict, ridge: Ridge) -> dict:
    """Repackage fitted Ridge coefficients into a JS-evaluable structure."""
    coef = ridge.coef_
    numeric = {}
    categorical = {}
    for i, colname in enumerate(spec["columns"]):
        c = float(coef[i])
        if colname.startswith("num::"):
            feat = colname[5:]
            numeric[feat] = {**spec["numeric"][feat], "coef": c}
        else:
            _, feat, val = colname.split("::", 2)
            categorical.setdefault(feat, {})[val] = c
    return {
        "intercept": float(ridge.intercept_),
        "numeric": numeric,
        "categorical": categorical,
        "numericFeatures": NUMERIC_FEATURES,
        "categoricalFeatures": CATEGORICAL_FEATURES,
    }


def _fit(df: pd.DataFrame) -> dict:
    """Fit one Ridge model on an already-built frame.

    Returns {predictions, linearModel, metrics, importances}. Shared by the
    pooled (combined) model and each per-`model` group model.
    predictions: {id: {predictedEur, residualEur, dealLabel}}
    """
    n = len(df)
    result = {"predictions": {}, "linearModel": None, "metrics": {"n": n},
              "importances": []}
    if n < 15:
        log.warning("only %d usable rows; skipping regression", n)
        result["metrics"]["note"] = "not enough data to train (need >= 15)"
        return result

    X, spec = _encode(df)
    y = df[TARGET].to_numpy(dtype=float)

    ridge = Ridge(alpha=10.0)
    ridge.fit(X, y)

    # Cross-validated predictions for honest residuals + metrics.
    k = min(5, n)
    cv = KFold(n_splits=k, shuffle=True, random_state=42)
    cv_pred = cross_val_predict(Ridge(alpha=10.0), X, y, cv=cv)
    mae = float(np.mean(np.abs(cv_pred - y)))
    ss_res = float(np.sum((y - cv_pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2)) or 1.0
    r2 = 1.0 - ss_res / ss_tot

    # In-sample fitted prediction for the shown fair price (stable per listing).
    fitted = ridge.predict(X)
    resid_std = float(np.std(y - fitted)) or 1.0
    for rid, pred, actual in zip(df["id"], fitted, y):
        residual = float(actual - pred)
        z = residual / resid_std
        label = "fair"
        if z <= -0.6:
            label = "good_deal"
        elif z >= 0.6:
            label = "overpriced"
        result["predictions"][rid] = {
            "predictedEur": round(float(pred)),
            "residualEur": round(residual),
            "dealLabel": label,
        }

    result["linearModel"] = _linear_export(spec, ridge)
    result["metrics"].update({"linear_mae": round(mae), "linear_r2": round(r2, 3)})

    # Feature importance from the standardized linear coefficients (interpretable
    # and stable on small data). Numerics are standardized so |coef| compares
    # directly; for a categorical we use the spread (std) of its one-hot coefs.
    agg: dict[str, float] = {}
    for i, colname in enumerate(spec["columns"]):
        feat = colname.split("::")[1]
        agg.setdefault(feat, []).append(float(ridge.coef_[i]))
    strength = {}
    for feat, coefs in agg.items():
        strength[feat] = abs(coefs[0]) if feat in NUMERIC_FEATURES else float(np.std(coefs))
    total = sum(strength.values()) or 1.0
    result["importances"] = sorted(
        ({"feature": f, "importance": round(v / total, 3)} for f, v in strength.items()),
        key=lambda d: -d["importance"],
    )

    # Gradient-boosted reference MAE (a stronger benchmark for context only).
    try:
        hgb = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05,
                                            random_state=42)
        hgb_pred = cross_val_predict(hgb, X, y, cv=cv)
        result["metrics"]["gbr_mae"] = round(float(np.mean(np.abs(hgb_pred - y))))
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("gradient-boosted reference failed: %s", exc)

    log.info("regression: n=%d linear_mae=%s r2=%s", n,
             result["metrics"].get("linear_mae"), result["metrics"].get("linear_r2"))
    return result


# Key for the pooled model in the exported `models` map.
COMBINED_KEY = "__combined__"


def train(records: list[dict], run_year: int) -> dict:
    """Fit a pooled model plus one model per `model` group.

    Returns the pooled model at the top level (backwards-compatible) and a
    `models` map keyed by group name (+ COMBINED_KEY) so the estimator can let
    the user switch between "all listings" and per-model regressions::

        {
          predictions, linearModel, metrics, importances,   # pooled (combined)
          models: {
            "__combined__": {label, linearModel, metrics},
            "Model 3":      {label, linearModel, metrics},
            "Model Y":      {label, linearModel, metrics},
          }
        }

    Per-listing predictions/deal labels stay sourced from the pooled model so
    every listing is scored on one consistent scale.
    """
    df = _frame(records, run_year)
    combined = _fit(df)

    models: dict[str, dict] = {COMBINED_KEY: {
        "label": "Alle modellen",
        "linearModel": combined["linearModel"],
        "metrics": combined["metrics"],
    }}
    for grp in sorted(df["model"].astype(str).unique()):
        sub = df[df["model"].astype(str) == grp]
        fit = _fit(sub)
        models[grp] = {
            "label": grp,
            "linearModel": fit["linearModel"],
            "metrics": fit["metrics"],
        }
        log.info("per-model fit: %s n=%d r2=%s", grp, fit["metrics"].get("n"),
                 fit["metrics"].get("linear_r2"))

    return {
        "predictions": combined["predictions"],
        "linearModel": combined["linearModel"],
        "metrics": combined["metrics"],
        "importances": combined["importances"],
        "models": models,
    }
