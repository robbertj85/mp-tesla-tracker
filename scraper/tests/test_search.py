"""Tests for the brand search query + pagination.

No network: `_fetch_page` is monkeypatched with canned pages, so these lock in the
query the registry builds and the way pagination reacts to the empty-200 responses
Marktplaats intermittently returns.
"""
import httpx
import pytest

from mp_tesla import config, search
from mp_tesla.config import BRANDS

ENYAQ = BRANDS["enyaq"]


def _listing(item_id: str, model: str = "Enyaq", **attrs) -> dict:
    base = {"model": model, "fuel": "Elektrisch", "transmission": "Automaat"}
    base.update(attrs)
    return {
        "itemId": item_id,
        "title": f"Skoda {model} iV 60",
        "attributes": [{"key": k, "value": v} for k, v in base.items()],
    }


def _page(*listings, total=200) -> dict:
    return {"listings": list(listings), "totalResultCount": total}


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    monkeypatch.setattr(search.time, "sleep", lambda *_: None)


# --- the Enyaq brand's query ------------------------------------------------------

def test_enyaq_search_params():
    params = dict(search._build_params(ENYAQ, offset=0, limit=30))
    assert params["l1CategoryId"] == "91"
    assert params["l2CategoryId"] == "151"          # Skoda sub-category of Auto's
    # Enyaq 13808 AND fuel Elektrisch 11756 (no body/transmission filter).
    assert ENYAQ.search_attr_ids == [13808, 11756]
    ranges = [v for k, v in search._build_params(ENYAQ, 0, 30) if k == "attributeRanges[]"]
    assert "constructionYear:2020:null" in ranges
    assert "PriceCents:null:6000000" in ranges
    # Every EV is a single-speed automatic, so no mileage/transmission range is set.
    assert not any(r.startswith("mileage") for r in ranges)


def test_enyaq_guard_accepts_electric_and_rejects_others():
    assert search._canonical_model(_listing("m1"), ENYAQ) == "Enyaq"
    # The one mis-tagged non-electric Enyaq on the site must not slip through.
    assert search._canonical_model(_listing("m2", fuel="Overige brandstoffen"), ENYAQ) is None
    # A different Skoda model in the same category is not ours.
    assert search._canonical_model(_listing("m3", model="Kodiaq"), ENYAQ) is None


def test_enyaq_is_registered_with_a_feature_spec():
    assert ENYAQ.pipeline in config.FEATURE_SPECS


# --- pagination resilience --------------------------------------------------------

def test_throttled_page_is_retried_before_ending_pagination(monkeypatch):
    """One throttled (empty-200) page mid-run must not truncate the scrape."""
    n_backoffs = len(config.EMPTY_PAGE_BACKOFF)
    pages = [
        _page(_listing("m1")),          # offset 0
        _page(),                        # offset 30 — throttled
        _page(_listing("m2")),          # offset 30 — retry succeeds
        *[_page()] * (n_backoffs + 1),  # offset 60 — genuinely exhausted
    ]
    calls = []

    def fake_fetch(client, brand, offset, limit):
        calls.append(offset)
        return pages.pop(0)

    monkeypatch.setattr(search, "_fetch_page", fake_fetch)
    got = [r["itemId"] for r in search.iter_search_listings(ENYAQ)]

    assert got == ["m1", "m2"]
    # The empty page was re-asked at the same offset rather than ending the loop.
    assert calls[:3] == [0, 30, 30]
    # A page still empty after every backoff step ends pagination.
    assert calls.count(60) == n_backoffs + 1


def test_empty_page_backoff_waits_tens_of_seconds(monkeypatch):
    """Retrying a few seconds later just gets throttled again — the pauses must be long."""
    slept: list[float] = []
    monkeypatch.setattr(search.time, "sleep", slept.append)
    monkeypatch.setattr(search, "_fetch_page", lambda *a: _page())
    search._fetch_page_checked(client=None, brand=ENYAQ, offset=0, limit=30)
    assert slept == list(config.EMPTY_PAGE_BACKOFF)
    assert slept == sorted(slept) and slept[0] >= 10


def test_empty_page_does_not_zero_the_expected_total(monkeypatch):
    """`totalResultCount: 0` from a blank response must not end pagination either."""
    pages = [_page(_listing("m1"), total=60), _page(), _page(_listing("m2"), total=60)]
    monkeypatch.setattr(search, "_fetch_page",
                        lambda client, brand, offset, limit: pages.pop(0))
    got = [r["itemId"] for r in search.iter_search_listings(ENYAQ, max_pages=2)]
    assert got == ["m1", "m2"]


# --- 403 / 429 blocks -------------------------------------------------------------

def _status_error(status: int):
    req = httpx.Request("GET", config.SEARCH_URL)
    return httpx.HTTPStatusError("blocked", request=req, response=httpx.Response(status, request=req))


def test_blocked_page_is_waited_out(monkeypatch):
    """A 403 that survives the short tenacity retries gets the long backoff, then recovers."""
    slept: list[float] = []
    monkeypatch.setattr(search.time, "sleep", slept.append)
    responses = [_status_error(403), _status_error(403), _page(_listing("m1"))]

    def fake_fetch(*a):
        r = responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    monkeypatch.setattr(search, "_fetch_page", fake_fetch)
    data = search._fetch_page_checked(client=None, brand=ENYAQ, offset=0, limit=30)
    assert data["listings"][0]["itemId"] == "m1"
    assert slept == list(config.BLOCKED_BACKOFF[:2])


def test_persistent_block_reraises_after_backoff(monkeypatch):
    slept: list[float] = []
    monkeypatch.setattr(search.time, "sleep", slept.append)

    def always_blocked(*a):
        raise _status_error(403)

    monkeypatch.setattr(search, "_fetch_page", always_blocked)
    with pytest.raises(httpx.HTTPStatusError):
        search._fetch_page_checked(client=None, brand=ENYAQ, offset=0, limit=30)
    assert slept == list(config.BLOCKED_BACKOFF)


def test_other_http_errors_are_not_backed_off(monkeypatch):
    slept: list[float] = []
    monkeypatch.setattr(search.time, "sleep", slept.append)

    def not_found(*a):
        raise _status_error(404)

    monkeypatch.setattr(search, "_fetch_page", not_found)
    with pytest.raises(httpx.HTTPStatusError):
        search._fetch_page_checked(client=None, brand=ENYAQ, offset=0, limit=30)
    assert slept == []
