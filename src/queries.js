const db = require('./db');
const { parseChazaraNotice } = require('./chazara-parser');

const DAILY_SCHEDULE_SQL = `
SELECT
  ds.daily_schedule_id,
  ds.shiur_type,
  ds.additional_notice,

  d.gregorian_date,
  d.hebrew_date,
  d.hebrew_date_he,
  d.day_of_week,
  d.is_yom_tov,
  d.special_date,

  s.time4mishna_shiur_id,
  s.shiur_title,
  s.start_mishna,
  s.end_mishna

FROM time4mishna_daily_schedule ds
JOIN dates_table d
  ON ds.date_id = d.date_id
JOIN time4mishna_shiurim s
  ON ds.time4mishna_shiur_id = s.time4mishna_shiur_id

WHERE d.gregorian_date = ?;
`;

function dailySchedulesByShiurTypesSql(count) {
  // db.query() runs through mysql2's execute() (prepared statements), which does not
  // expand a single `?` into an array for IN clauses the way query() does, so build one
  // placeholder per shiur_type instead.
  const placeholders = Array(count).fill('?').join(', ');

  return `
SELECT
  ds.daily_schedule_id,
  ds.shiur_type,
  ds.additional_notice,

  d.gregorian_date,
  d.hebrew_date,
  d.hebrew_date_he,
  d.day_of_week,
  d.is_yom_tov,
  d.special_date,

  s.time4mishna_shiur_id,
  s.shiur_title,
  s.start_mishna,
  s.end_mishna

FROM time4mishna_daily_schedule ds
JOIN dates_table d
  ON ds.date_id = d.date_id
JOIN time4mishna_shiurim s
  ON ds.time4mishna_shiur_id = s.time4mishna_shiur_id

WHERE ds.shiur_type IN (${placeholders})

ORDER BY d.gregorian_date ASC, ds.shiur_type ASC;
`;
}

const SCHEDULE_BY_SHIUR_TYPE_SQL = `
SELECT
  ds.daily_schedule_id,
  ds.shiur_type,
  ds.additional_notice,

  d.gregorian_date,
  d.hebrew_date,
  d.hebrew_date_he,
  d.day_of_week,
  d.is_yom_tov,
  d.special_date

FROM time4mishna_daily_schedule ds
JOIN dates_table d
  ON ds.date_id = d.date_id

WHERE ds.shiur_type = ?

ORDER BY d.gregorian_date ASC;
`;

const MISHNA_BY_REF_SQL = `
SELECT m.mishna_id, m.perek, m.mishna
FROM mishnayos_table m
JOIN masechta_table mt
  ON m.masechta_id = mt.masechta_id
WHERE mt.masechta_name = ? AND m.perek = ? AND m.mishna = ?;
`;

const MISHNA_AT_PEREK_FIRST_SQL = `
SELECT m.mishna_id, m.perek, m.mishna
FROM mishnayos_table m
JOIN masechta_table mt
  ON m.masechta_id = mt.masechta_id
WHERE mt.masechta_name = ? AND m.perek = ?
ORDER BY m.mishna ASC
LIMIT 1;
`;

const MISHNA_AT_PEREK_LAST_SQL = `
SELECT m.mishna_id, m.perek, m.mishna
FROM mishnayos_table m
JOIN masechta_table mt
  ON m.masechta_id = mt.masechta_id
WHERE mt.masechta_name = ? AND m.perek = ?
ORDER BY m.mishna DESC
LIMIT 1;
`;

const MISHNA_RANGE_SQL = `
SELECT
  m.mishna_id,
  m.perek,
  m.mishna,
  m.mishna_text,

  mt.masechta_id,
  mt.masechta_name,
  mt.alt_names AS masechta_alt_names,

  st.seder_id,
  st.seder_name,
  st.alt_names AS seder_alt_names

FROM mishnayos_table m
JOIN masechta_table mt
  ON m.masechta_id = mt.masechta_id
JOIN sedarim_table st
  ON mt.seder_id = st.seder_id

WHERE m.mishna_id BETWEEN ? AND ?

ORDER BY m.mishna_id ASC;
`;

async function getDailyScheduleByGregorianDate(gregorianDate) {
  const rows = await db.query(DAILY_SCHEDULE_SQL, [gregorianDate]);
  return rows[0] || null;
}

async function getMishnayosByRange(startMishnaId, endMishnaId) {
  // TODO: If mishna_id values ever stop being sequential, replace this with
  // perek/mishna range logic instead of relying on BETWEEN start_mishna AND end_mishna.
  return db.query(MISHNA_RANGE_SQL, [startMishnaId, endMishnaId]);
}

async function getDailySchedulesByShiurTypes(shiurTypes) {
  if (!Array.isArray(shiurTypes) || shiurTypes.length === 0) {
    throw new Error('shiurTypes must be a non-empty array.');
  }

  return db.query(dailySchedulesByShiurTypesSql(shiurTypes.length), shiurTypes);
}

async function getDailySchedulesByShiurType(shiurType) {
  return db.query(SCHEDULE_BY_SHIUR_TYPE_SQL, [shiurType]);
}

// Resolves one end of a parsed chazara reference to a concrete mishna_id.
// `mishna === null` means the notice named a whole perek rather than a specific mishna;
// `edge` picks which mishna_id bounds that perek ('first' for a range start, 'last' for a
// range end).
async function resolveChazaraRef({ masechtaName, perek, mishna }, edge) {
  const rows = mishna
    ? await db.query(MISHNA_BY_REF_SQL, [masechtaName, perek, mishna])
    : await db.query(edge === 'first' ? MISHNA_AT_PEREK_FIRST_SQL : MISHNA_AT_PEREK_LAST_SQL, [masechtaName, perek]);

  return rows[0] || null;
}

// Parses a chazara `additional_notice` and resolves it to a { startMishnaId, endMishnaId }
// range. Returns null for an empty/missing notice. Throws if the notice can't be parsed, or if
// either end can't be resolved against mishnayos_table, or if the resolved range is reversed
// (never silently swapped — see chazara-parser.js for the formats this expects).
async function resolveChazaraRange(notice) {
  const parsed = parseChazaraNotice(notice);

  if (!parsed) {
    return null;
  }

  const [startRow, endRow] = await Promise.all([
    resolveChazaraRef(parsed.start, 'first'),
    resolveChazaraRef(parsed.end, 'last')
  ]);

  if (!startRow) {
    throw new Error(
      `Could not find ${parsed.start.masechtaName} ${parsed.start.perek}${
        parsed.start.mishna ? `.${parsed.start.mishna}` : ''
      } for notice "${notice}".`
    );
  }

  if (!endRow) {
    throw new Error(
      `Could not find ${parsed.end.masechtaName} ${parsed.end.perek}${
        parsed.end.mishna ? `.${parsed.end.mishna}` : ''
      } for notice "${notice}".`
    );
  }

  if (endRow.mishna_id < startRow.mishna_id) {
    throw new Error(
      `Resolved chazara range is reversed for notice "${notice}" ` +
        `(start mishna_id ${startRow.mishna_id} > end mishna_id ${endRow.mishna_id}).`
    );
  }

  return { startMishnaId: startRow.mishna_id, endMishnaId: endRow.mishna_id };
}

module.exports = {
  DAILY_SCHEDULE_SQL,
  MISHNA_RANGE_SQL,
  dailySchedulesByShiurTypesSql,
  getDailyScheduleByGregorianDate,
  getMishnayosByRange,
  getDailySchedulesByShiurTypes,
  getDailySchedulesByShiurType,
  resolveChazaraRange
};
