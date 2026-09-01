const { toHebrewNumber } = require('./hebrew-numerals');

const HEBREW_MASECHTA_NAMES = {
  Berachos: 'ברכות',
  Peah: 'פאה',
  Demai: 'דמאי',
  Kilayim: 'כלאים',
  Sheviis: 'שביעית',
  Terumos: 'תרומות',
  Maasros: 'מעשרות',
  'Maaser Sheni': 'מעשר שני',
  Challah: 'חלה',
  Orlah: 'ערלה',
  Bikkurim: 'ביכורים'
};

function requireMishnayos(mishnayos) {
  if (!Array.isArray(mishnayos) || mishnayos.length === 0) {
    throw new Error('Cannot build titles or filenames without Mishnayos.');
  }
}

function getFirstAndLast(mishnayos) {
  requireMishnayos(mishnayos);
  return {
    first: mishnayos[0],
    last: mishnayos[mishnayos.length - 1]
  };
}

function hebrewMasechtaName(englishName) {
  return HEBREW_MASECHTA_NAMES[englishName] || englishName || 'Mishnah';
}

function crossesMasechta(first, last) {
  return (first.masechta_id ?? first.masechta_name) !== (last.masechta_id ?? last.masechta_name);
}

function buildHebrewTitle(mishnayos) {
  const { first, last } = getFirstAndLast(mishnayos);
  const firstRef = `${hebrewMasechtaName(first.masechta_name)} ${toHebrewNumber(first.perek)}:${toHebrewNumber(
    first.mishna
  )}`;
  const lastRef = `${toHebrewNumber(last.perek)}:${toHebrewNumber(last.mishna)}`;

  if (crossesMasechta(first, last)) {
    return `${firstRef}-${hebrewMasechtaName(last.masechta_name)} ${lastRef}`;
  }

  return `${firstRef}-${lastRef}`;
}

function buildEnglishTitle(mishnayos) {
  const { first, last } = getFirstAndLast(mishnayos);
  const firstRef = `${first.masechta_name || 'Mishnah'} ${first.perek}:${first.mishna}`;
  const lastRef = `${last.perek}:${last.mishna}`;

  if (crossesMasechta(first, last)) {
    return `${firstRef}-${last.masechta_name || 'Mishnah'} ${lastRef}`;
  }

  return `${firstRef}-${lastRef}`;
}

function slugify(value, fallback = 'mishnah') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || fallback;
}

function buildOutputFilename(mishnayos) {
  const { first, last } = getFirstAndLast(mishnayos);
  const firstRef = `${slugify(first.masechta_name)}_${first.perek}.${first.mishna}`;
  const lastRef = `${last.perek}.${last.mishna}`;

  if (crossesMasechta(first, last)) {
    return `${firstRef}-${slugify(last.masechta_name)}_${lastRef}`;
  }

  return `${firstRef}-${lastRef}`;
}

function buildOutputParts(mishnayos) {
  const { first } = getFirstAndLast(mishnayos);

  return {
    seder: slugify(first.seder_name, 'unknown_seder'),
    masechta: slugify(first.masechta_name, 'unknown_masechta')
  };
}

module.exports = {
  HEBREW_MASECHTA_NAMES,
  buildHebrewTitle,
  buildEnglishTitle,
  buildOutputFilename,
  buildOutputParts,
  crossesMasechta,
  hebrewMasechtaName,
  slugify
};
