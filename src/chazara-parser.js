// Parses the free-text `additional_notice` field used on 'chazara' (review) schedule rows.
// There is no structured mishna range for these rows (unlike 'regular' rows, which link a
// time4mishna_shiurim record with start_mishna/end_mishna) — the range is only ever recorded
// as a human-written note. Observed formats, covering all populated notices as of 2026-09:
//
//   "Brachos 1.1-4.1"            same masechta, exact mishna range
//   "Brachos 1-2"                same masechta, whole-perek range (no mishna numbers)
//   "Brachos 7.2 - Peah 1.3"     crossing masechta, exact mishna range
//   "Brachos 9 - Peah 1"         crossing masechta, whole-perek range
//   "Bikkurim 4"                 single whole perek, no range/dash at all
//
// Masechta names in the notices match `masechta_table.masechta_name` exactly (verified against
// all 417 non-null notices currently in the DB), so this parser intentionally does not attempt
// fuzzy or case-insensitive matching. If a notice doesn't match one of the shapes above, it
// throws rather than guessing at a range.
const NOTICE_PATTERN =
  /^([A-Za-z]+(?:\s[A-Za-z]+)*)\s+(\d+)(?:\.(\d+))?\s*(?:-\s*(?:([A-Za-z]+(?:\s[A-Za-z]+)*)\s+)?(\d+)(?:\.(\d+))?)?\s*$/;

// Returns { start: { masechtaName, perek, mishna }, end: { masechtaName, perek, mishna } },
// where `mishna` is null when the notice named a whole perek instead of a specific mishna.
// Returns null for an empty/missing notice. Throws for anything that doesn't match a known shape.
function parseChazaraNotice(notice) {
  if (!notice || !notice.trim()) {
    return null;
  }

  const trimmed = notice.trim();
  const match = trimmed.match(NOTICE_PATTERN);

  if (!match) {
    throw new Error(`Could not parse chazara notice: "${notice}"`);
  }

  const [, masechta1, perek1, mishna1, masechta2, perek2, mishna2] = match;

  const start = {
    masechtaName: masechta1,
    perek: Number(perek1),
    mishna: mishna1 ? Number(mishna1) : null
  };

  // No dash at all ("Bikkurim 4"): the whole notice is one perek, start === end.
  const end = perek2
    ? {
        masechtaName: masechta2 || masechta1,
        perek: Number(perek2),
        mishna: mishna2 ? Number(mishna2) : null
      }
    : { ...start };

  return { start, end };
}

module.exports = {
  NOTICE_PATTERN,
  parseChazaraNotice
};
