#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Generate Hugo tour pages from JSON data — Python port of generate-tour-pages.ps1.

Why Python: the .ps1 uses a here-string with `---` front-matter that Windows
PowerShell 5.1 mis-parses (`---` read as the `--` operator) whenever `pwsh` 7+
is absent, which is the norm under the harness — so every clone's build agent
had to hand-roll a Python fallback (Runs 25/26 + the whole 5-site batch). This
is that fallback, committed once in the scaffold so clones just run it.

Behaviour mirrors the .ps1 exactly:
  - site root = parent of this script's dir
  - read data/tours_config.yaml -> tour IDs (lines matching `- <id>`)
  - auto-detect the offers JSON via data/gyg_*.json OR data/*offers*.json glob
    (largest if several) - provider-neutral since 2026-08-28
  - write content/tours/<slug>.md per tour (type: tour, tourId, url, description)
  - slug = diacritic-stripped, non-alnum->hyphen, lowercased
  - UTF-8, no BOM
Aborts loudly (exit 1) on missing/empty tours_config or no offers JSON.

Usage:  python scripts/generate-tour-pages.py
"""
import sys, os, re, glob, json, unicodedata, datetime

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def die(msg):
    sys.stderr.write("ERROR: " + msg + "\n")
    sys.exit(1)


def slugify(title):
    # Step 0: transliterate Nordic/Germanic letters that NFD does NOT decompose
    # (ø, æ, å, ß, ð, þ are distinct letters, not base+combining-mark — without this
    # "Tromsø" -> "troms" and "Henningsvær" -> "henningsvr").
    # Turkish dotless i (U+0131) and dotted capital I (U+0130) belong in the SAME
    # map for the same reason: they are distinct LETTERS, not base+combining-mark,
    # so NFD leaves them intact and Step 2's ASCII filter deletes them outright.
    # "Topkapı" -> "topkap" is the identical failure to "Tromsø" -> "troms", one
    # alphabet over. The other Turkish letters (ç ğ ö ş ü) DO decompose and are
    # already handled by Step 1 — only these two need transliterating here.
    # (Reported on topkapipalace-tours.com 2026-08-28.)
    nordic = {"ø": "o", "Ø": "O", "æ": "ae", "Æ": "Ae", "å": "a", "Å": "A",
              "ß": "ss", "ð": "d", "Ð": "D", "þ": "th", "Þ": "Th", "ł": "l", "Ł": "L",
              "ı": "i", "İ": "I"}
    title = "".join(nordic.get(c, c) for c in title)
    # Step 1: NFD-normalize and drop combining marks (ō->o, ā->a, ç->c, è->e)
    nfd = unicodedata.normalize("NFD", title)
    no_marks = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    # Step 1b: keep numbers readable before punctuation is stripped. A decimal point
    # became nothing ("2.5 Hour" -> "25-hour", a 25-hour flight), and a number glued
    # to its unit stayed glued ("35min" -> "35min"). Decimals become a hyphen
    # ("2-5-hour"), and digits are split from a following unit word ("35-min").
    # Ordinals and labels stay intact: 1st, 2nd, 3rd, 4th, 4WD, 4x4, A1, B2B.
    # (Reported on franzjosefhelicoptertour.com 2026-10-19.)
    no_marks = re.sub(r"(\d)[.,](\d)", r"\1-\2", no_marks)
    no_marks = re.sub(r"(\d)(?!(?:st|nd|rd|th|wd|x\d)\b)([a-zA-Z]{2,})", r"\1-\2", no_marks, flags=re.I)
    # Step 2: strip non-ASCII-alphanumeric, collapse whitespace + hyphens
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", no_marks)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.lower().strip("-")


def main():
    tours_config = os.path.join(SITE_ROOT, "data", "tours_config.yaml")
    if not os.path.exists(tours_config):
        die("data/tours_config.yaml not found at %s — create it with a "
            "'featured_tours:' list of tour IDs (mirror data/experiences_config.yaml IDs)." % tours_config)

    with open(tours_config, encoding="utf-8") as f:
        yaml_text = f.read()
    # Tour ids may be numeric (GetYourGuide) or alphanumeric product codes
    # (Viator, e.g. "2295HANGI"), quoted or bare, with a trailing # comment.
    tour_ids = [m.group(1) for m in
                re.finditer(r'^\s*-\s*"?([A-Za-z0-9_-]+)"?', yaml_text, re.M)]
    if not tour_ids:
        die("data/tours_config.yaml contains no tour IDs (pattern '- <id>'). "
            "Populate it with IDs that mirror data/experiences_config.yaml.")

    data_dir = os.path.join(SITE_ROOT, "data")
    # Provider-neutral: gyg_*.json (GetYourGuide) or *offers*.json (Viator and
    # anything else the kit grows). Patched 2026-08-28 on
    # rotoruamaoriexperience.com — the scaffold copy was still GYG-only.
    offers = sorted(set(glob.glob(os.path.join(data_dir, "gyg_*.json")) +
                        glob.glob(os.path.join(data_dir, "*offers*.json"))))
    if not offers:
        die("No offers JSON found in %s — expected gyg_*.json or *offers*.json." % data_dir)
    if len(offers) > 1:
        offers.sort(key=lambda p: os.path.getsize(p), reverse=True)
        sys.stderr.write("WARNING: multiple offers JSONs in data/ — using largest: %s\n"
                         % os.path.basename(offers[0]))
    offers_path = offers[0]
    print("Reading offers from: %s" % os.path.basename(offers_path))
    with open(offers_path, encoding="utf-8") as f:
        all_tours = json.load(f)
    # STRING keys: Viator product codes are alphanumeric, so an int cast is a
    # hard ValueError here, not the float64 rounding risk it guards against on GYG.
    by_id = {str(t.get("id")): t for t in all_tours if t.get("id") is not None}

    tours_dir = os.path.join(SITE_ROOT, "content", "tours")
    os.makedirs(tours_dir, exist_ok=True)

    today = datetime.date.today().isoformat()
    count = 0
    # slug -> tour id that claimed it. Two tours whose GYG titles differ only by
    # punctuation (or not at all) slugify to ONE filename, and the second write
    # silently replaces the first: the loop still prints a "Generated:" line per
    # tour and exits 0, so the run reports more pages than exist on disk. On
    # dolomitestoursfromvenice.com (2026-09-17) t900569 and t1244479 shipped the
    # byte-identical title "From Venice: The Best of the Dolomites Mountains Day
    # Trip", and the 17-review, 3.8-rated tour overwrote the 940-review, 4.7-rated
    # PRICE-FLOOR tour's page. Nothing downstream catches it -- the surviving page
    # is valid, deep, and passes the depth gate; it just sells the wrong product.
    claimed = {}
    for tid in tour_ids:
        tour = by_id.get(str(tid))
        if not tour:
            sys.stderr.write("WARNING: Tour ID %s not found in JSON\n" % tid)
            continue
        title = (tour.get("title") or "").strip()
        slug = slugify(title)
        if slug in claimed:
            die("slug collision: t%s and t%s both slugify to '%s'\n"
                "        t%s: %s\n"
                "        t%s: %s\n"
                "  One would silently overwrite the other. Fix by giving the tour\n"
                "  you want a page a distinct `metaTitle`-independent title in the\n"
                "  offers JSON, or by dropping one id from tours_config.yaml (keep\n"
                "  the one with more reviews) and leaving it as a card." % (
                    claimed[slug], tour.get("id"), slug,
                    claimed[slug], by_id.get(str(claimed[slug]), {}).get("title", ""),
                    tour.get("id"), title))
        claimed[slug] = tour.get("id")
        # SEO/AEO front-matter: prefer curated metaTitle (<=60) / metaDescription (<=160) /
        # keywords from the offers JSON; fall back to the tour title + abstract.
        page_title = (tour.get("metaTitle") or title).replace('"', '\\"')
        description = (tour.get("metaDescription") or tour.get("abstract") or "").replace('"', '\\"')
        keywords = tour.get("keywords") or []
        kw_yaml = ""
        if keywords:
            kw_yaml = "keywords:\n" + "".join(
                '  - "%s"\n' % str(k).replace('"', '\\"') for k in keywords)
        fm = (
            "---\n"
            'title: "%s"\n'
            "date: %s\n"
            "draft: false\n"
            'type: "tour"\n'
            'tourId: "%s"\n'
            'slug: "%s"\n'
            'description: "%s"\n'
            "%s"
            "---\n"
        ) % (page_title, today, str(tour.get("id")), slug, description, kw_yaml)
        out = os.path.join(tours_dir, slug + ".md")
        with open(out, "w", encoding="utf-8", newline="\n") as f:
            f.write(fm)
        print("Generated: %s" % out)
        count += 1

    print("\nGenerated %d tour pages" % count)


if __name__ == "__main__":
    main()
