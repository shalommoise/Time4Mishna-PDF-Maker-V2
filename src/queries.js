const db = require('./db');

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

module.exports = {
  DAILY_SCHEDULE_SQL,
  MISHNA_RANGE_SQL,
  getDailyScheduleByGregorianDate,
  getMishnayosByRange
};
