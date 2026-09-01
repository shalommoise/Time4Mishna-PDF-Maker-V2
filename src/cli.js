#!/usr/bin/env node

const fsp = require('fs/promises');
const path = require('path');
const { Command, InvalidArgumentError } = require('commander');
const { projectRoot } = require('./config');
const { closePool } = require('./db');
const { generateHtml } = require('./generate-html');
const { generatePdfFromHtmlFile } = require('./generate-pdf');
const { buildOutputFilename, buildOutputParts } = require('./filename-builder');
const {
  getDailyScheduleByGregorianDate,
  getMishnayosByRange,
  getDailySchedulesByShiurTypes,
  getDailySchedulesByShiurType,
  resolveChazaraRange
} = require('./queries');

class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserFacingError';
  }
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new InvalidArgumentError('must be a positive integer');
  }

  return parsed;
}

function parseGregorianDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidArgumentError('must use YYYY-MM-DD format');
  }

  return value;
}

async function renderOutputs({ mishnayos, schedule = null, label }) {
  if (!Array.isArray(mishnayos) || mishnayos.length === 0) {
    throw new UserFacingError('No Mishnayos were found for the requested range.');
  }

  const root = projectRoot();
  const filename = buildOutputFilename(mishnayos);
  const { seder, masechta } = buildOutputParts(mishnayos);
  const htmlPath = path.join(root, 'output', 'html', seder, masechta, `${filename}.html`);
  const pdfPath = path.join(root, 'output', 'pdf', seder, masechta, `${filename}.pdf`);

  await generateHtml({ mishnayos, schedule, outputPath: htmlPath });
  await generatePdfFromHtmlFile(htmlPath, pdfPath);

  console.log(`Generated ${label}:`);
  console.log(`HTML: ${htmlPath}`);
  console.log(`PDF:  ${pdfPath}`);

  return { htmlPath, pdfPath };
}

async function generateByDate(options) {
  try {
    const schedule = await getDailyScheduleByGregorianDate(options.date);

    if (!schedule) {
      throw new UserFacingError(`No daily Mishnah schedule found for Gregorian date ${options.date}.`);
    }

    const mishnayos = await getMishnayosByRange(schedule.start_mishna, schedule.end_mishna);

    if (mishnayos.length === 0) {
      throw new UserFacingError(
        `No Mishnayos were found between IDs ${schedule.start_mishna} and ${schedule.end_mishna}.`
      );
    }

    await renderOutputs({
      mishnayos,
      schedule,
      label: `date ${options.date}`
    });
  } finally {
    await closePool();
  }
}

async function generateByIds(options) {
  try {
    if (options.start > options.end) {
      throw new UserFacingError('--start must be less than or equal to --end.');
    }

    const mishnayos = await getMishnayosByRange(options.start, options.end);

    if (mishnayos.length === 0) {
      throw new UserFacingError(`No Mishnayos were found between IDs ${options.start} and ${options.end}.`);
    }

    await renderOutputs({
      mishnayos,
      label: `Mishnah IDs ${options.start}-${options.end}`
    });
  } finally {
    await closePool();
  }
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateCycle(options) {
  try {
    const shiurTypes = options.shiurTypes
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (shiurTypes.length === 0) {
      throw new UserFacingError('--shiur-types must include at least one shiur_type.');
    }

    const schedules = await getDailySchedulesByShiurTypes(shiurTypes);

    if (schedules.length === 0) {
      throw new UserFacingError(`No daily schedule rows found for shiur_type(s): ${shiurTypes.join(', ')}.`);
    }

    console.log(`Found ${schedules.length} scheduled day(s) for shiur_type(s): ${shiurTypes.join(', ')}.`);

    const stats = { generated: 0, skipped: 0, failed: 0 };
    const root = projectRoot();

    for (const schedule of schedules) {
      const label = `${schedule.gregorian_date} (${schedule.shiur_type})`;

      try {
        if (!schedule.start_mishna || !schedule.end_mishna) {
          console.warn(`Skipping ${label}: no linked mishna range (start_mishna/end_mishna is missing).`);
          stats.failed += 1;
          continue;
        }

        const mishnayos = await getMishnayosByRange(schedule.start_mishna, schedule.end_mishna);

        if (mishnayos.length === 0) {
          console.warn(
            `Skipping ${label}: no Mishnayos found between IDs ${schedule.start_mishna} and ${schedule.end_mishna}.`
          );
          stats.failed += 1;
          continue;
        }

        const filename = buildOutputFilename(mishnayos);
        const { seder, masechta } = buildOutputParts(mishnayos);
        const htmlPath = path.join(root, 'output', 'html', seder, masechta, `${filename}.html`);
        const pdfPath = path.join(root, 'output', 'pdf', seder, masechta, `${filename}.pdf`);

        if (!options.force) {
          const [htmlExists, pdfExists] = await Promise.all([fileExists(htmlPath), fileExists(pdfPath)]);

          if (htmlExists && pdfExists) {
            console.log(`Skipping ${label}: ${filename} already exists.`);
            stats.skipped += 1;
            continue;
          }
        }

        await generateHtml({ mishnayos, schedule, outputPath: htmlPath });
        await generatePdfFromHtmlFile(htmlPath, pdfPath);

        console.log(`Generated ${label}: ${filename}`);
        stats.generated += 1;
      } catch (error) {
        console.error(`Failed ${label}: ${error.message}`);
        stats.failed += 1;
      }
    }

    console.log('---');
    console.log(`Generated: ${stats.generated}`);
    console.log(`Skipped:   ${stats.skipped}`);
    console.log(`Failed:    ${stats.failed}`);

    if (stats.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await closePool();
  }
}

async function generateChazaraCycle(options) {
  try {
    const schedules = await getDailySchedulesByShiurType('chazara');

    if (schedules.length === 0) {
      throw new UserFacingError('No chazara daily schedule rows found.');
    }

    console.log(`Found ${schedules.length} scheduled chazara day(s).`);

    const stats = { generated: 0, skipped: 0, noNotice: 0, failed: 0 };
    const root = projectRoot();

    for (const schedule of schedules) {
      const label = `${schedule.gregorian_date} (chazara)`;

      try {
        const notice = schedule.additional_notice;

        if (!notice || !notice.trim()) {
          console.warn(`Skipping ${label}: no additional_notice to parse.`);
          stats.noNotice += 1;
          continue;
        }

        const range = await resolveChazaraRange(notice);
        const mishnayos = await getMishnayosByRange(range.startMishnaId, range.endMishnaId);

        if (mishnayos.length === 0) {
          console.warn(
            `Skipping ${label}: no Mishnayos found between IDs ${range.startMishnaId} and ${range.endMishnaId} (from "${notice.trim()}").`
          );
          stats.failed += 1;
          continue;
        }

        const filename = buildOutputFilename(mishnayos);
        const { seder, masechta } = buildOutputParts(mishnayos);
        // Chazara output lives under its own output/chazara/ tree, mirroring the html/pdf/seder/
        // masechta layout used elsewhere, so it never mixes with 'regular' output that happens
        // to share the same masechta/perek/mishna filename.
        const htmlPath = path.join(root, 'output', 'chazara', 'html', seder, masechta, `${filename}.html`);
        const pdfPath = path.join(root, 'output', 'chazara', 'pdf', seder, masechta, `${filename}.pdf`);

        if (!options.force) {
          const [htmlExists, pdfExists] = await Promise.all([fileExists(htmlPath), fileExists(pdfPath)]);

          if (htmlExists && pdfExists) {
            console.log(`Skipping ${label}: ${filename} already exists.`);
            stats.skipped += 1;
            continue;
          }
        }

        await generateHtml({ mishnayos, schedule, outputPath: htmlPath });
        await generatePdfFromHtmlFile(htmlPath, pdfPath);

        console.log(`Generated ${label}: ${filename} (from "${notice.trim()}")`);
        stats.generated += 1;
      } catch (error) {
        console.error(`Failed ${label} ("${schedule.additional_notice}"): ${error.message}`);
        stats.failed += 1;
      }
    }

    console.log('---');
    console.log(`Generated: ${stats.generated}`);
    console.log(`Skipped:   ${stats.skipped}`);
    console.log(`No notice: ${stats.noNotice}`);
    console.log(`Failed:    ${stats.failed}`);

    if (stats.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await closePool();
  }
}

async function generateSample() {
  const samplePath = path.join(projectRoot(), 'samples', 'terumos_1_4-1_7.sample.json');
  const sample = JSON.parse(await fsp.readFile(samplePath, 'utf8'));

  await renderOutputs({
    mishnayos: sample.mishnayos,
    schedule: sample.schedule,
    label: 'sample Terumos 1:4-1:7'
  });
}

const program = new Command();

program.name('time4mishna-pdf-generator').description('Generate Time4Mishna Mishnah PDFs.');

program
  .command('generate:date')
  .description('Generate a PDF for the daily Mishnah shiur on a Gregorian date.')
  .requiredOption('--date <date>', 'Gregorian date in YYYY-MM-DD format', parseGregorianDate)
  .action(generateByDate);

program
  .command('generate:ids')
  .description('Generate a PDF for an explicit Mishnah ID range.')
  .requiredOption('--start <id>', 'Start mishna_id', parsePositiveInteger)
  .requiredOption('--end <id>', 'End mishna_id', parsePositiveInteger)
  .action(generateByIds);

program
  .command('generate:cycle')
  .description(
    'Generate PDFs for every scheduled day in the current cycle. ' +
      "Only shiur_types with a linked mishna range are supported; 'chazara' rows " +
      'currently have no start_mishna/end_mishna and are skipped by default.'
  )
  .option('--shiur-types <types>', 'Comma-separated shiur_type values to include', 'regular')
  .option('--force', 'Regenerate output even if the HTML/PDF already exists', false)
  .action(generateCycle);

program
  .command('generate:chazara-cycle')
  .description(
    'Generate PDFs for every scheduled chazara day, parsing its mishna range from the ' +
      'free-text additional_notice field (chazara rows have no linked shiur/mishna range).'
  )
  .option('--force', 'Regenerate output even if the HTML/PDF already exists', false)
  .action(generateChazaraCycle);

program
  .command('generate:sample')
  .description('Generate a sample PDF without connecting to the database.')
  .action(generateSample);

program.parseAsync(process.argv).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
