# time4mishna-pdf-generator

A small Node.js CLI for generating clean, branded Time4Mishna Mishnah text PDFs from the existing `time4torah_db` MySQL database.

The generator renders an HTML/CSS template with EJS, then exports the result to an A4 PDF with Playwright Chromium.

## What This Does Not Do

- It does not create database tables.
- It does not run migrations.
- It does not write to the database.
- It does not use WordPress APIs.
- It does not include real credentials.

Use a read-only database user for this tool where possible.

## Install

```bash
npm install
```

## Configure Database Access

Copy the example environment file and fill in local credentials:

```bash
cp .env.example .env
```

Required values:

```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=time4mishna_reader
DB_PASSWORD=
DB_NAME=time4torah_db
```

The sample generator does not require `.env`.

## Add Assets

Place available logos in `assets/logos/`:

- `time4mishna.png`
- `time4torah.png`
- `jewish-futures.svg`

The main header first looks for `time4mishna.png`, then `time4torah.png`. If neither exists, it renders a text fallback. If `jewish-futures.svg` is missing, the footer still renders the required text without the logo.

Optional Hebrew font files can be placed in `assets/fonts/`. Supported formats are `.woff2`, `.woff`, `.otf`, and `.ttf`. The template uses `Guttman Hatzvi` for Hebrew text and will prefer a matching Guttman Hatzvi font file when present.

## Generate Sample Without DB

```bash
npm run generate:sample
```

This uses `samples/terumos_1_4-1_7.sample.json` and writes:

```text
output/html/zeraim/terumos/terumos_1_4-1_7.html
output/pdf/zeraim/terumos/terumos_1_4-1_7.pdf
```

## Generate By Date

```bash
npm run generate:date -- --date 2026-06-01
```

This looks up the daily schedule row for the Gregorian date, reads the linked `start_mishna` and `end_mishna`, fetches that Mishnah range, renders HTML, and exports the PDF.

## Generate By Mishnah IDs

```bash
npm run generate:ids -- --start 123 --end 126
```

This fetches all Mishnayos where `mishna_id BETWEEN start AND end`, renders HTML, and exports the PDF.

Current assumption: the existing system uses sequential Mishnah IDs. If that changes, the query should be replaced with perek/mishna range logic.

## Output Paths

Generated files are written under the seder and masechta:

```text
output/html/<seder>/<masechta>/<filename>.html
output/pdf/<seder>/<masechta>/<filename>.pdf
```

Filenames are lowercase and machine-friendly, for example:

```text
terumos_1_4-1_7.pdf
terumos_1_8-2_1.pdf
```

## Hebrew And RTL Rendering

The template sets Hebrew document direction, right-aligns Mishnah text, preserves line breaks, and uses Hebrew-style headings such as:

```text
פרק א – משנה ד
```

The project includes a small English-to-Hebrew masechta name mapping for common masechtos. If a masechta is not mapped, the English database name is used as a fallback.
