"""
NovaJobs apply engine, ported from engine.py v11 (spec 012).

PORTED UNCHANGED (debugged against real ATS forms): the profile -> field
map, label extraction, application-form detection, radio / <select> /
custom-combobox filling, the EEO rule (never guessed, never sent to Gemini,
"prefer not to answer" only when offered), consent checkboxes, the fuzzy
screening-answer cache + Gemini fallback, the <40%-filled guard, the
single-best submit-button choice, and success detection.

CHANGED FOR THE REBUILD:
- No Supabase: the answer cache is data/engine/qa_cache.json; the profile,
  resume and queue come from the Next.js app's local stores (engine/store.py).
- No scraping / TF-IDF: jobs come from the central pool via the queue.
- The browser is a Hyperbrowser cloud session (HYPERBROWSER_API_KEY), or a
  local visible Chromium when no key is set. Stealth and Hyperbrowser's
  CAPTCHA solving stay OFF, and there is no NopeCHA: when a form shows a
  CAPTCHA the engine waits for the candidate to solve it in the session's
  live view, then submits; if nobody does, the job goes to Needs review.
- The resume is uploaded as file contents, which works with a remote browser.
- Pause/Cancel: stop() is checked between steps and in every wait; it raises
  Cancelled so the worker can park or drop the application.
- apply_to_job() returns (outcome, reason) so every failure carries its
  real reason, and reports each step through `report`.
"""

from __future__ import annotations

import difflib
import json
import os
import random
import re
import shutil
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Iterator

import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

from engine.gemini import GEMINI_API_KEY, GEMINI_URL
from engine.store import DATA, read_json, write_json

load_dotenv()

QA_CACHE = DATA / "engine" / "qa_cache.json"
NA = "N/A"

Report = Callable[[str], None]
Stop = Callable[[], bool]


class Cancelled(Exception):
    """The candidate paused or cancelled the application mid-run."""


def _resume_payload(resume_path: str) -> dict:
    return {"name": Path(resume_path).name, "mimeType": "application/pdf", "buffer": Path(resume_path).read_bytes()}

# Questions asking for protected/voluntary self-identification data. These
# are never answered by Gemini and never randomly filled -- the applicant's
# actual demographic identity must not be fabricated.
EEO_KEYWORDS = re.compile(
    r"race|ethnic|sexual.?orientation|transgender|gender.?identity|"
    r"\bdisab|veteran|protected.?class",
    re.I,
)
PREFER_NOT_TO_ANSWER_PATTERNS = re.compile(r"prefer not to|decline to|don'?t wish to answer|choose not to", re.I)
CONSENT_KEYWORDS = re.compile(
    r"i agree|consent|acknowledge|terms.{0,20}(of service|and conditions)|"
    r"privacy policy|terms of use|i have read|authorize.{0,20}(collect|process|store)",
    re.I,
)


# Resume text (for Gemini context)

def _extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        import io

        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(pdf_bytes))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as e:
        print(f"[ResumeExtract] PDF text extraction failed: {e}")
        return ""


_RESUME_TEXT_CACHE: dict[str, str] = {}


def _get_resume_text(resume_path: str | None) -> str:
    if not resume_path:
        return ""
    if resume_path in _RESUME_TEXT_CACHE:
        return _RESUME_TEXT_CACHE[resume_path]
    try:
        with open(resume_path, "rb") as f:
            text = _extract_pdf_text(f.read())
    except Exception as e:
        print(f"[ResumeText ERROR] {e}")
        text = ""
    _RESUME_TEXT_CACHE[resume_path] = text
    return text


# Screening-answer cache (fuzzy) + Gemini

STOPWORDS = {
    "a", "an", "the", "is", "are", "do", "does", "did", "you", "your",
    "please", "select", "choose", "enter", "of", "to", "for", "and",
    "or", "in", "on", "at", "this", "that", "i", "my", "me", "we",
}


def _normalize_question(text: str) -> str:
    norm = (text or "").strip().lower()
    norm = re.sub(r"[*]+\s*$", "", norm)
    norm = re.sub(r"[^\w\s]", " ", norm)
    return " ".join(w for w in norm.split() if w and w not in STOPWORDS)


def _question_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    seq_ratio = difflib.SequenceMatcher(None, a, b).ratio()
    set_a, set_b = set(a.split()), set(b.split())
    jaccard = len(set_a & set_b) / len(set_a | set_b) if set_a and set_b else 0.0
    return max(seq_ratio, jaccard)


def _cache_rows(user_id: str) -> list[dict]:
    return [r for r in read_json(QA_CACHE, []) if r.get("user_id") == user_id]


def _find_cached_answer(user_id: str, question_text: str, choices: list[str] | None = None) -> str | None:
    norm = _normalize_question(question_text)
    if not norm:
        return None
    best_ratio, best_answer, best_q = 0.0, None, None
    for row in _cache_rows(user_id):
        ratio = _question_similarity(norm, row.get("question_key", "") or "")
        if ratio > best_ratio:
            best_ratio, best_answer, best_q = ratio, row.get("answer"), row.get("question")

    CACHE_HIT_THRESHOLD = 0.65
    if best_ratio < CACHE_HIT_THRESHOLD or not best_answer:
        print(f"[AnswerCache] MISS for '{question_text[:60]}' (best: '{(best_q or '')[:60]}' @ {best_ratio:.2f})")
        return None
    if not choices or best_answer in choices:
        print(f"[AnswerCache] HIT for '{question_text[:60]}' @ {best_ratio:.2f} -> '{best_answer}'")
        return best_answer
    close = difflib.get_close_matches(best_answer, choices, n=1, cutoff=0.5)
    if close:
        print(f"[AnswerCache] HIT (option remapped) for '{question_text[:60]}' -> '{close[0]}'")
        return close[0]
    return None


def _cache_answer(user_id: str, question_text: str, answer: str, input_tokens: int, output_tokens: int) -> None:
    rows = read_json(QA_CACHE, [])
    rows.append({
        "user_id": user_id,
        "question": question_text,
        "question_key": _normalize_question(question_text),
        "answer": answer,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    })
    write_json(QA_CACHE, rows)


def _ask_gemini(question_text: str, profile: dict, resume_text: str, choices: list[str] | None = None) -> tuple[str | None, int, int]:
    """Never used for EEO questions: callers filter those out first."""
    if not GEMINI_API_KEY:
        print("[Gemini] GEMINI_API_KEY not set -- leaving field unanswered")
        return None, 0, 0

    context = (
        f"Applicant name: {profile.get('full_name') or NA}\n"
        f"Current/target job title: {profile.get('job_title') or NA}\n"
        f"Years of experience: {profile.get('years_experience') or NA}\n"
        f"Skills: {', '.join(profile.get('resume_skills') or [])}\n"
        f"Location: {profile.get('location') or NA}\n"
        f"Work authorization: {profile.get('work_authorization') or NA}\n"
        f"Resume text (may be truncated):\n{resume_text[:6000]}\n"
    )
    if choices:
        prompt = (
            "You are filling out a job application on behalf of the applicant below. "
            "Answer the following screening question by choosing exactly one option "
            "from the provided list. Reply with ONLY the option text, copied exactly "
            "as given, nothing else.\n\n"
            f"{context}\nQuestion: {question_text}\nOptions: {json.dumps(choices)}\n"
        )
    else:
        prompt = (
            "You are filling out a job application on behalf of the applicant below. "
            "Answer the following screening question truthfully and concisely based "
            "only on the information given. If the answer cannot be determined from "
            "the information provided, reply with exactly: UNKNOWN\n\n"
            f"{context}\nQuestion: {question_text}\n"
        )

    input_tokens, output_tokens, answer = 0, 0, None
    for attempt in range(3):
        try:
            resp = requests.post(GEMINI_URL, params={"key": GEMINI_API_KEY}, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=20)
            if resp.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            resp.raise_for_status()
            data = resp.json()
            answer = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            usage = data.get("usageMetadata", {})
            input_tokens = usage.get("promptTokenCount", 0)
            output_tokens = usage.get("candidatesTokenCount", 0)
            break
        except Exception as e:
            print(f"[Gemini ERROR] {e}")
            if attempt < 2:
                time.sleep(2)
                continue
            return None, input_tokens, output_tokens
    if not answer or answer.upper() == "UNKNOWN":
        return None, input_tokens, output_tokens
    if choices:
        if answer in choices:
            return answer, input_tokens, output_tokens
        close = difflib.get_close_matches(answer, choices, n=1, cutoff=0.6)
        return (close[0] if close else None), input_tokens, output_tokens
    return answer, input_tokens, output_tokens


def get_screening_answer(user_id: str, question_text: str, profile: dict, resume_path: str | None, choices: list[str] | None = None) -> str | None:
    """EEO -> never answered. Then the fuzzy cache, then one Gemini call (cached)."""
    if EEO_KEYWORDS.search(question_text or ""):
        return None
    cached = _find_cached_answer(user_id, question_text, choices)
    if cached:
        return cached
    answer, input_tokens, output_tokens = _ask_gemini(question_text, profile, _get_resume_text(resume_path), choices)
    if answer:
        _cache_answer(user_id, question_text, answer, input_tokens, output_tokens)
    return answer


# Profile -> form-field mapping

def _build_field_map(profile: dict) -> dict:
    full_name = profile.get("full_name") or ""
    parts = full_name.split()
    first, last = (parts[0], " ".join(parts[1:])) if parts else ("", "")
    return {
        "first_name": profile.get("first_name") or first or NA,
        "last_name": profile.get("last_name") or last or NA,
        "full_name": full_name or NA,
        "email": profile.get("email") or NA,
        "phone": profile.get("phone") or NA,
        "location": profile.get("location") or NA,
        "city": profile.get("location") or NA,
        "linkedin": profile.get("linkedin_url") or NA,
        "github": profile.get("github_url") or NA,
        "website": profile.get("portfolio_url") or NA,
        "job_title": profile.get("job_title") or NA,
        "experience": str(profile.get("years_experience") or NA),
        "cover_letter": profile.get("cover_letter") or NA,
        "salary": str(profile.get("desired_salary") or NA),
        "start_date": profile.get("earliest_start_date") or NA,
        "work_auth": profile.get("work_authorization") or NA,
        "sponsorship": profile.get("needs_sponsorship") or NA,
        "veteran": profile.get("veteran_status") or NA,
        "disability": profile.get("disability_status") or NA,
        "gender": profile.get("gender") or NA,
        "race": profile.get("race_ethnicity") or NA,
    }


FIELD_KEYWORDS = [
    (r"first.?name|given.?name", "first_name"),
    (r"last.?name|surname|family.?name", "last_name"),
    (r"full.?name|^name$|applicant.?name|your.?name", "full_name"),
    (r"e-?mail", "email"),
    (r"phone|mobile|telephone", "phone"),
    (r"linkedin", "linkedin"),
    (r"github", "github"),
    (r"portfolio|website|personal.?site", "website"),
    (r"city|location|address", "location"),
    (r"current.?title|job.?title|position", "job_title"),
    (r"years?.?of.?experience|experience", "experience"),
    (r"cover.?letter|why.?do.?you.?want|message", "cover_letter"),
    (r"salary|compensation|pay.?expectation", "salary"),
    (r"start.?date|availability", "start_date"),
    (r"work.?authoriz|legally.?authorized|visa", "work_auth"),
    (r"sponsor", "sponsorship"),
    (r"veteran", "veteran"),
    (r"disab", "disability"),
    (r"gender", "gender"),
    (r"race|ethnicity", "race"),
]


def _match_field_key(label_text: str) -> str | None:
    label_l = (label_text or "").lower()
    for pattern, key in FIELD_KEYWORDS:
        if re.search(pattern, label_l):
            return key
    return None


def _get_label_text(page, el) -> str:
    try:
        for attr in ("aria-label", "placeholder", "name", "id"):
            val = el.get_attribute(attr)
            if val:
                return val
        el_id = el.get_attribute("id")
        if el_id:
            label = page.locator(f'label[for="{el_id}"]').first
            if label.count() > 0:
                return label.inner_text()
    except Exception:
        pass
    return ""


def _detect_captcha(page) -> str | None:
    """Detects (never solves) common CAPTCHA widgets."""
    try:
        html = page.content().lower()
        if "recaptcha" in html:
            return "reCAPTCHA"
        if "hcaptcha" in html:
            return "hCaptcha"
        if "cf-turnstile" in html or "turnstile" in html:
            return "Cloudflare Turnstile"
        if "are you human" in html or "verify you are human" in html:
            return "Human verification"
    except Exception:
        pass
    return None


def _looks_like_application_form(page) -> bool:
    """Only fill pages with apply-form markers (resume upload, or email + name), incl. iframes."""
    try:
        for frame in [page] + list(page.frames):
            try:
                has_file_input = frame.locator('input[type="file"]').count() > 0
                has_email_input = frame.locator(
                    'input[type="email"], input[name*="email" i], input[id*="email" i], input[placeholder*="email" i]'
                ).count() > 0
                has_name_input = frame.locator(
                    'input[name*="name" i], input[id*="name" i], input[placeholder*="name" i]'
                ).count() > 0
                if has_file_input or (has_email_input and has_name_input):
                    return True
            except Exception:
                continue
        return False
    except Exception:
        return False


def _fill_radio_groups(frame, page, profile: dict, resume_path: str | None, user_id: str) -> int:
    try:
        radios = frame.locator('input[type="radio"]').all()
    except Exception:
        return 0

    groups: dict[str, list] = {}
    for r in radios:
        try:
            if not r.is_visible():
                continue
            name = r.get_attribute("name") or ""
            if name:
                groups.setdefault(name, []).append(r)
        except Exception:
            continue

    filled = 0
    for group in groups.values():
        try:
            if any(g.is_checked() for g in group):
                continue
            question_text = ""
            try:
                legend = group[0].locator("xpath=ancestor::fieldset[1]//legend").first
                if legend.count() > 0:
                    question_text = legend.inner_text()
            except Exception:
                pass
            if not question_text:
                question_text = _get_label_text(page, group[0])

            option_labels = [_get_label_text(page, r) or (r.get_attribute("value") or "") for r in group]

            if EEO_KEYWORDS.search(question_text) or EEO_KEYWORDS.search(" ".join(option_labels)):
                pna_idx = next((i for i, t in enumerate(option_labels) if PREFER_NOT_TO_ANSWER_PATTERNS.search(t)), None)
                if pna_idx is not None:
                    group[pna_idx].check()
                    filled += 1
                continue

            answer = get_screening_answer(user_id, question_text, profile, resume_path, choices=option_labels)
            if answer and answer in option_labels:
                group[option_labels.index(answer)].check()
                filled += 1
        except Exception:
            continue
    return filled


def fill_application_form(page, profile: dict, resume_path: str | None, user_id: str) -> dict:
    """Fills what it can; unanswerable text fields get 'N/A'; EEO is never guessed. Never clicks submit."""
    if not _looks_like_application_form(page):
        return {"filled": 0, "left_na": 0, "captcha": None, "skipped_not_a_form": True}

    field_map = _build_field_map(profile)
    filled, left_na = 0, 0
    frames = [page] + [f for f in page.frames if f != page.main_frame]

    for frame in frames:
        filled += _fill_radio_groups(frame, page, profile, resume_path, user_id)
        try:
            inputs = frame.locator("input, textarea, select").all()
        except Exception:
            continue

        for el in inputs:
            try:
                if not el.is_visible():
                    continue
                input_type = (el.get_attribute("type") or "").lower()
                tag = el.evaluate("e => e.tagName.toLowerCase()")
                if input_type in ("hidden", "submit", "button"):
                    continue

                if input_type == "checkbox":
                    label_text = _get_label_text(page, el)
                    if EEO_KEYWORDS.search(label_text):
                        continue
                    try:
                        if el.is_checked():
                            continue
                    except Exception:
                        pass
                    # Only required consent boxes; never marketing opt-ins.
                    if CONSENT_KEYWORDS.search(label_text):
                        try:
                            el.check()
                            filled += 1
                        except Exception:
                            pass
                    continue

                if input_type == "radio":
                    continue

                role = (el.get_attribute("role") or "").lower()
                label_probe = (_get_label_text(page, el) or "").lower()
                if input_type == "search" or role == "searchbox" or "search" in label_probe:
                    continue

                if input_type == "file":
                    if resume_path:
                        el.set_input_files(_resume_payload(resume_path))
                        filled += 1
                    continue

                label_text = _get_label_text(page, el)
                key = _match_field_key(label_text)
                value = field_map.get(key, NA) if key else NA

                if tag == "select":
                    try:
                        if value != NA:
                            el.select_option(label=value)
                            filled += 1
                            continue
                        real_choices = []
                        for opt in el.locator("option").all():
                            opt_value = (opt.get_attribute("value") or "").strip()
                            opt_text = (opt.inner_text() or "").strip()
                            if not opt_value or not opt_text or re.search(r"^select|choose|--|please select", opt_text, re.I):
                                continue
                            real_choices.append(opt_text)
                        if not real_choices:
                            left_na += 1
                            continue
                        if EEO_KEYWORDS.search(label_text):
                            pna = next((c for c in real_choices if PREFER_NOT_TO_ANSWER_PATTERNS.search(c)), None)
                            if pna:
                                el.select_option(label=pna)
                                filled += 1
                            else:
                                left_na += 1
                            continue
                        answer = get_screening_answer(user_id, label_text, profile, resume_path, choices=real_choices)
                        if answer:
                            el.select_option(label=answer)
                            filled += 1
                        else:
                            left_na += 1
                    except Exception:
                        left_na += 1
                    continue

                if value != NA:
                    el.fill(value)
                    filled += 1
                    continue
                if EEO_KEYWORDS.search(label_text):
                    left_na += 1
                    continue
                answer = get_screening_answer(user_id, label_text, profile, resume_path)
                if answer:
                    el.fill(answer)
                    filled += 1
                else:
                    el.fill(NA)
                    left_na += 1
            except Exception:
                continue

    filled += _handle_custom_dropdowns(page, frames, profile, resume_path, user_id)
    return {"filled": filled, "left_na": left_na, "captcha": _detect_captcha(page)}


def _handle_custom_dropdowns(page, frames, profile: dict, resume_path: str | None, user_id: str) -> int:
    """role="combobox" widgets (Greenhouse EEO and screening questions)."""
    filled = 0
    for frame in frames:
        try:
            comboboxes = frame.locator('[role="combobox"]').all()
        except Exception:
            continue
        for cb in comboboxes:
            try:
                if not cb.is_visible():
                    continue
                label_text = _get_label_text(page, cb) or ""
                if "search" in label_text.lower():
                    continue
                cb.click()
                page.wait_for_timeout(300)

                option_locator = None
                for loc in (frame.locator('[role="option"]'), page.locator('[role="option"]')):
                    try:
                        if loc.count() > 0:
                            option_locator = loc
                            break
                    except Exception:
                        continue
                if not option_locator:
                    page.keyboard.press("Escape")
                    continue
                visible_options = [o for o in option_locator.all() if o.is_visible()]
                if not visible_options:
                    page.keyboard.press("Escape")
                    continue
                option_texts = [(o.inner_text() or "").strip() for o in visible_options]

                if EEO_KEYWORDS.search(label_text):
                    pna_idx = next((i for i, t in enumerate(option_texts) if PREFER_NOT_TO_ANSWER_PATTERNS.search(t)), None)
                    if pna_idx is not None:
                        visible_options[pna_idx].click()
                        filled += 1
                    else:
                        page.keyboard.press("Escape")
                    continue

                answer = get_screening_answer(user_id, label_text, profile, resume_path, choices=option_texts)
                if answer and answer in option_texts:
                    visible_options[option_texts.index(answer)].click()
                    filled += 1
                else:
                    page.keyboard.press("Escape")
            except Exception:
                try:
                    page.keyboard.press("Escape")
                except Exception:
                    pass
    return filled


# Submit + success detection

AUTO_SUBMIT_WAIT_MS = int(os.getenv("AUTO_SUBMIT_WAIT_MS", str(90 * 1000)))
MANUAL_SUBMIT_WAIT_MS = 20 * 60 * 1000
# How long to wait for the candidate to solve a CAPTCHA in the engine window.
CAPTCHA_WAIT_S = int(os.getenv("CAPTCHA_WAIT_S", "180"))

SUBMIT_PREFERRED_LABELS = [
    "submit application", "submit your application", "submit my application",
    "send application", "submit application now",
]
SUBMIT_FALLBACK_LABELS = ["apply now", "submit", "apply"]
SUBMIT_SKIP_LABELS = re.compile(
    r"\b(next|continue|save|cancel|back|previous|close|dismiss|deny|accept|"
    r"cookie|learn more|view|search|filter|upload|add|remove|edit|"
    r"sign in|log in|login|register|create account)\b",
    re.I,
)
SUCCESS_TEXT_PATTERNS = [
    "thank you for applying", "application received", "application submitted",
    "successfully submitted", "we've received your application",
    "your application has been submitted", "application complete",
    "thanks for applying", "thank you for your application",
    "application has been received", "we have received your application",
    "successfully applied", "application was submitted",
    "your application is complete", "submitted successfully",
]


def _captcha_appears_solved(page) -> bool:
    """A solved reCAPTCHA/hCaptcha/Turnstile writes a token into a hidden field."""
    try:
        for frame in [page] + list(page.frames):
            for sel in ('textarea[name="g-recaptcha-response"]', 'textarea[id="g-recaptcha-response"]',
                        'input[name="h-captcha-response"]', 'textarea[name="h-captcha-response"]',
                        'input[name="cf-turnstile-response"]', 'input[name="g-recaptcha-response"]'):
                try:
                    loc = frame.locator(sel)
                    if loc.count() > 0:
                        val = loc.first.input_value()
                        if val and len(val) > 10:
                            return True
                except Exception:
                    continue
            try:
                for sel in ('#recaptcha-anchor[aria-checked="true"]', '.recaptcha-checkbox[aria-checked="true"]',
                            'span[role="checkbox"][aria-checked="true"]'):
                    if frame.locator(sel).count() > 0:
                        return True
            except Exception:
                pass
        return False
    except Exception:
        return False


def _page_shows_success(page, start_url: str) -> bool:
    try:
        if page.is_closed():
            return False
        current = page.url
        if current and start_url and current.split("?")[0].rstrip("/") != start_url.split("?")[0].rstrip("/"):
            low = current.lower()
            if not any(x in low for x in ("/apply", "/application", "job_application", "grnhse_app")):
                return True
        body_text = page.inner_text("body").lower()
        if any(p in body_text for p in SUCCESS_TEXT_PATTERNS):
            return True
    except Exception:
        pass
    return False


def _button_label(el) -> str:
    try:
        text = (el.inner_text() or "").strip()
        if text:
            return text
    except Exception:
        pass
    for attr in ("aria-label", "value", "title", "name"):
        try:
            v = el.get_attribute(attr)
            if v and str(v).strip():
                return str(v).strip()
        except Exception:
            continue
    return ""


def _submit_priority(label: str) -> int | None:
    """Lower is better; None = never click."""
    if not label:
        return None
    low = re.sub(r"\s+", " ", label.strip().lower())
    if SUBMIT_SKIP_LABELS.search(low):
        return None
    for i, phrase in enumerate(SUBMIT_PREFERRED_LABELS):
        if phrase == low or phrase in low:
            return i
    for i, phrase in enumerate(SUBMIT_FALLBACK_LABELS):
        if phrase == low:
            return 100 + i
        if phrase == "apply" and low in ("apply", "apply for this job", "apply to this job"):
            return 100 + i
        if phrase != "apply" and phrase in low:
            return 100 + i
    return None


def _click_submit_button(page) -> bool:
    """Clicks exactly one final submit button, the best-scored one."""
    candidates: list[tuple[int, object, str]] = []
    for frame in [page] + list(page.frames):
        for sel in ('button[type="submit"]', 'input[type="submit"]', "button", 'a[role="button"]', '[role="button"]', 'input[type="button"]'):
            try:
                els = frame.locator(sel).all()
            except Exception:
                continue
            for el in els:
                try:
                    if not el.is_visible():
                        continue
                    try:
                        if not el.is_enabled():
                            continue
                    except Exception:
                        pass
                    label = _button_label(el)
                    prio = _submit_priority(label)
                    if prio is None:
                        continue
                    try:
                        if (el.get_attribute("type") or "").lower() == "submit" and prio >= 100:
                            prio = 50
                    except Exception:
                        pass
                    candidates.append((prio, el, label))
                except Exception:
                    continue
    if not candidates:
        return False
    candidates.sort(key=lambda x: x[0])
    _, best_el, best_label = candidates[0]
    print(f"[Apply] Clicking submit button: '{best_label}'")
    try:
        try:
            best_el.scroll_into_view_if_needed(timeout=3000)
        except Exception:
            pass
        best_el.click(timeout=5000)
        return True
    except Exception:
        try:
            best_el.click(force=True, timeout=3000)
            return True
        except Exception:
            return False


def _wait_for_submission_result(page, start_url: str, timeout_ms: int, stop: Stop) -> bool:
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        if stop():
            raise Cancelled()
        try:
            if page.is_closed():
                return False
            if _page_shows_success(page, start_url):
                return True
        except Exception:
            pass
        time.sleep(1.5)
    return False


def _wait_for_human_captcha(page, report: Report, stop: Stop) -> bool:
    report("Waiting for you to solve the CAPTCHA in the live view")
    deadline = time.time() + CAPTCHA_WAIT_S
    while time.time() < deadline:
        if stop():
            raise Cancelled()
        if page.is_closed():
            return False
        if _captcha_appears_solved(page):
            return True
        time.sleep(1.5)
    return False


HYPERBROWSER_API_KEY = os.getenv("HYPERBROWSER_API_KEY", "").strip()


@contextmanager
def _browser_page(p, on_live: Callable[[str], None]) -> Iterator:
    """A Hyperbrowser cloud session when HYPERBROWSER_API_KEY is set, else a local visible Chromium.

    Never stealth, never automated CAPTCHA solving: the candidate solves
    CAPTCHAs themselves in the live view.
    """
    if HYPERBROWSER_API_KEY:
        from hyperbrowser import Hyperbrowser
        from hyperbrowser.models import CreateSessionParams

        client = Hyperbrowser(api_key=HYPERBROWSER_API_KEY)
        session = client.sessions.create(
            params=CreateSessionParams(use_stealth=False, use_ultra_stealth=False, solve_captchas=False, timeout_minutes=30)
        )
        try:
            if session.live_url:
                on_live(session.live_url)
            browser = p.chromium.connect_over_cdp(session.ws_endpoint)
            context = browser.contexts[0] if browser.contexts else browser.new_context()
            yield context.pages[0] if context.pages else context.new_page()
        finally:
            try:
                client.sessions.stop(session.id)
            except Exception as e:
                print(f"[Hyperbrowser] Couldn't stop session {session.id}: {e}")
        return

    user_data = tempfile.mkdtemp(prefix="novajobs_pw_")
    context = p.chromium.launch_persistent_context(user_data_dir=user_data, headless=False, args=["--start-maximized"], no_viewport=True)
    try:
        yield context.pages[0] if context.pages else context.new_page()
    finally:
        try:
            context.close()
        except Exception:
            pass
        shutil.rmtree(user_data, ignore_errors=True)


Outcome = tuple[str, str]  # (applied | needs_review | failed, reason)


def apply_to_job(
    job: dict, profile: dict, resume_path: str, user_id: str, auto_submit: bool,
    report: Report, stop: Stop, on_live: Callable[[str], None],
) -> Outcome:
    """Opens the posting, fills the form, submits, and confirms. Returns (status, reason).

    auto_submit is the candidate's own setting: off, the form is filled and the
    candidate clicks Submit in the live view.

    Raises Cancelled when the candidate pauses or cancels mid-run.
    """
    url = job.get("postingUrl") or ""
    if not isinstance(url, str) or not url.strip():
        return "failed", "This job has no posting URL."

    def step(message: str) -> None:
        if stop():
            raise Cancelled()
        report(message)

    try:
        with sync_playwright() as p, _browser_page(p, on_live) as page:
            return _apply_in_page(page, url, profile, resume_path, user_id, auto_submit, step, stop)
    except Cancelled:
        raise
    except Exception as e:
        return "failed", f"The engine hit an error on the posting: {str(e).splitlines()[0][:160]}"


def _apply_in_page(page, url: str, profile: dict, resume_path: str, user_id: str, auto_submit: bool, report: Report, stop: Stop) -> Outcome:
    report("Opening the posting")
    page.goto(url, timeout=45000, wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    if page.is_closed():
        return "failed", "The browser window was closed while the posting loaded."

    # Cookie banners overlay the form and hide fields from Playwright.
    for sel in ["button:has-text('Accept')", "button:has-text('ACCEPT')", "button:has-text('Dismiss')",
                "button:has-text('DISMISS')", "button:has-text('Deny')", "button:has-text('DENY')",
                "#onetrust-accept-btn-handler"]:
        try:
            btn = page.locator(sel).first
            if btn.count() > 0 and btn.is_visible():
                btn.click(timeout=3000)
                page.wait_for_timeout(500)
                break
        except Exception:
            continue

    # Entry "Apply" on a listing page only, never once the form is on screen.
    if not _looks_like_application_form(page):
        for sel in ["a:has-text('Apply for this job')", "button:has-text('Apply for this job')",
                    "a:has-text('Apply Now')", "button:has-text('Apply Now')",
                    "a:has-text('Apply')", "button:has-text('Apply')"]:
            try:
                btn = page.locator(sel).first
                if btn.count() > 0 and btn.is_visible():
                    if "submit" in (btn.inner_text() or "").strip().lower():
                        continue
                    btn.click()
                    page.wait_for_timeout(1500)
                    break
            except Exception:
                continue

    if page.is_closed():
        return "failed", "The browser window was closed before the form loaded."

    has_form = page.locator("input, textarea, select").count() > 0 or any(
        f.locator("input, textarea, select").count() > 0 for f in page.frames
    )
    if not has_form:
        return "failed", "No application form on the posting page. It may be closed or need a sign-in."

    for _ in range(3):  # embedded widgets (Greenhouse iframe) render late
        if _looks_like_application_form(page):
            break
        page.wait_for_timeout(1500)

    report("Filling the application form")
    result = fill_application_form(page, profile, resume_path, user_id)
    if result.get("skipped_not_a_form"):
        return "failed", "The posting opened a careers or search page, not an application form."

    total = result["filled"] + result["left_na"]
    if total >= 3 and result["filled"] / total < 0.4:
        return "failed", f"Form layout not supported: only {result['filled']} of {total} fields could be filled."
    if total == 0:
        return "failed", "The application form had no fields the engine could fill."

    start_url = page.url
    if not auto_submit:
        report("Form filled. Review it in the live view and click Submit")
        if _wait_for_submission_result(page, start_url, MANUAL_SUBMIT_WAIT_MS, stop):
            return "applied", ""
        return "needs_review", "Filled, but not submitted within 20 minutes of review."

    captcha = result.get("captcha")
    if captcha and not _captcha_appears_solved(page):
        if not _wait_for_human_captcha(page, report, stop):
            return "needs_review", f"{captcha} wasn't solved within {CAPTCHA_WAIT_S // 60} minutes. Finish this one on the posting."

    time.sleep(random.uniform(1.0, 2.5))
    report("Submitting")
    for attempt in range(1, 4):
        if page.is_closed():
            break
        if _page_shows_success(page, start_url):
            return "applied", ""
        if not _click_submit_button(page):
            return "needs_review", "Filled, but no Submit button was found on the form."
        wait_ms = min(25000, AUTO_SUBMIT_WAIT_MS) if attempt < 3 else AUTO_SUBMIT_WAIT_MS
        if _wait_for_submission_result(page, start_url, wait_ms, stop):
            return "applied", ""
        late = _detect_captcha(page)
        if late and not _captcha_appears_solved(page) and not _wait_for_human_captcha(page, report, stop):
            return "needs_review", f"{late} appeared on submit and wasn't solved. Finish this one on the posting."

    return "needs_review", "Submitted, but the site never confirmed it. Check the posting before re-applying."
