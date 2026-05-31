const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');
const ejs = require('ejs');
const { projectRoot } = require('./config');
const { buildEnglishTitle, buildHebrewTitle } = require('./filename-builder');
const { toHebrewNumber } = require('./hebrew-numerals');
const { cleanMishnaText } = require('./text-cleanup');

function firstExistingPath(paths) {
  return paths.find((filePath) => fs.existsSync(filePath)) || null;
}

async function firstFontPath(fontsDir) {
  try {
    const entries = (await fsp.readdir(fontsDir)).sort((a, b) => a.localeCompare(b));
    const fontFiles = entries.filter((entry) => /\.(woff2?|otf|ttf)$/i.test(entry));
    const fontFile =
      fontFiles.find((entry) => /guttman[-_\s]*hatzvi/i.test(entry)) ||
      fontFiles[0];

    return fontFile ? path.join(fontsDir, fontFile) : null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function fileUrl(filePath) {
  return filePath ? pathToFileURL(filePath).href : null;
}

function formatDateInfo(schedule) {
  if (!schedule) {
    return null;
  }

  return {
    gregorianDate: schedule.gregorian_date,
    hebrewDate: schedule.hebrew_date_he || schedule.hebrew_date,
    dayOfWeek: schedule.day_of_week,
    specialDate: schedule.special_date,
    additionalNotice: schedule.additional_notice
  };
}

function normalizeMishnayos(mishnayos) {
  return mishnayos.map((mishna) => ({
    ...mishna,
    mishna_text: cleanMishnaText(mishna.mishna_text),
    perek_he: toHebrewNumber(mishna.perek),
    mishna_he: toHebrewNumber(mishna.mishna)
  }));
}

async function buildTemplateData({ mishnayos, schedule = null }) {
  const root = projectRoot();
  const assetsDir = path.join(root, 'assets');
  const logosDir = path.join(root, 'assets', 'logos');
  const fontsDir = path.join(root, 'assets', 'fonts');
  const normalizedMishnayos = normalizeMishnayos(mishnayos);
  const brandLogo = firstExistingPath([
    path.join(logosDir, 'time4mishna.png'),
    path.join(logosDir, 'time4torah.png'),
    path.join(assetsDir, 'time4mishna.png'),
    path.join(assetsDir, 'time4torah.png')
  ]);
  const jewishFuturesLogo = firstExistingPath([
    path.join(logosDir, 'jewish-futures.svg'),
    path.join(assetsDir, 'jewish-futures.svg')
  ]);
  const hebrewFont = await firstFontPath(fontsDir);

  return {
    hebrewTitle: buildHebrewTitle(normalizedMishnayos),
    englishTitle: buildEnglishTitle(normalizedMishnayos),
    dateInfo: formatDateInfo(schedule),
    schedule,
    mishnayos: normalizedMishnayos,
    assets: {
      brandLogo: fileUrl(brandLogo),
      jewishFuturesLogo: fileUrl(jewishFuturesLogo),
      hebrewFont: fileUrl(hebrewFont)
    }
  };
}

async function generateHtml({ mishnayos, schedule = null, outputPath }) {
  if (!Array.isArray(mishnayos) || mishnayos.length === 0) {
    throw new Error('No Mishnayos were provided for HTML generation.');
  }

  const root = projectRoot();
  const templatePath = path.join(root, 'templates', 'daily-mishnah.ejs');
  const cssPath = path.join(root, 'templates', 'daily-mishnah.css');
  const [template, css] = await Promise.all([
    fsp.readFile(templatePath, 'utf8'),
    fsp.readFile(cssPath, 'utf8')
  ]);
  const data = await buildTemplateData({ mishnayos, schedule });
  const html = ejs.render(template, { ...data, css }, { filename: templatePath });

  if (outputPath) {
    await fsp.mkdir(path.dirname(outputPath), { recursive: true });
    await fsp.writeFile(outputPath, html, 'utf8');
  }

  return html;
}

module.exports = {
  buildTemplateData,
  generateHtml
};
