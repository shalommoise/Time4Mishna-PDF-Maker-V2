const ONES = {
  1: 'א',
  2: 'ב',
  3: 'ג',
  4: 'ד',
  5: 'ה',
  6: 'ו',
  7: 'ז',
  8: 'ח',
  9: 'ט'
};

const TENS = {
  10: 'י',
  20: 'כ',
  30: 'ל',
  40: 'מ',
  50: 'נ',
  60: 'ס',
  70: 'ע',
  80: 'פ',
  90: 'צ'
};

const HUNDREDS = {
  100: 'ק',
  200: 'ר',
  300: 'ש',
  400: 'ת'
};

function toHebrewNumber(num) {
  const value = Number(num);

  if (!Number.isInteger(value) || value <= 0) {
    return String(num);
  }

  let remaining = value;
  let result = '';

  while (remaining >= 400) {
    result += HUNDREDS[400];
    remaining -= 400;
  }

  for (const amount of [300, 200, 100]) {
    if (remaining >= amount) {
      result += HUNDREDS[amount];
      remaining -= amount;
    }
  }

  if (remaining === 15) {
    return `${result}טו`;
  }

  if (remaining === 16) {
    return `${result}טז`;
  }

  const tens = Math.floor(remaining / 10) * 10;
  if (tens > 0) {
    result += TENS[tens];
    remaining -= tens;
  }

  if (remaining > 0) {
    result += ONES[remaining];
  }

  return result;
}

module.exports = {
  toHebrewNumber
};
