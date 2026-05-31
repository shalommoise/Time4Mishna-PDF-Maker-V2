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

function buildHebrewTitle(mishnayos) {
  const { first, last } = getFirstAndLast(mishnayos);
  const name = hebrewMasechtaName(first.masechta_name);

  return `${name} ${toHebrewNumber(first.perek)}:${toHebrewNumber(first.mishna)}-${toHebrewNumber(
    last.perek
  )}:${toHebrewNumber(last.mishna)}`;
}

function buildEnglishTitle(mishnayos) {
  const { first, last } = getFirstAndLast(mishnayos);
  const name = first.masechta_name || 'Mishnah';

  return `${name} ${first.perek}:${first.mishna}-${last.perek}:${last.mishna}`;
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
  const name = slugify(first.masechta_name);

  return `${name}_${first.perek}_${first.mishna}-${last.perek}_${last.mishna}`;
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
  hebrewMasechtaName,
  slugify
};
