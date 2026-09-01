const fsp = require('fs/promises');
const path = require('path');

async function collectPdfPaths(dir) {
  let entries;

  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await collectPdfPaths(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      results.push(fullPath);
    }
  }

  return results;
}

async function filesAreIdentical(pathA, pathB) {
  const [bufA, bufB] = await Promise.all([fsp.readFile(pathA), fsp.readFile(pathB)]);
  return bufA.equals(bufB);
}

// Copies every PDF from `sourceDirs` into one flat directory (no subfolders), for easy bulk
// upload (e.g. to a GCS bucket). Output filenames are content-addressed by masechta/perek/mishna,
// so the same range generated from two schedule rows (e.g. a chazara review that happens to
// exactly match a regular day) can produce the same filename with *different* content, since
// each PDF also renders its own schedule's date/notice. Rather than silently overwriting one
// with the other, a real content collision gets a suffix (from `labelFor`) instead.
async function flattenPdfs({ sourceDirs, destDir, labelFor }) {
  await fsp.mkdir(destDir, { recursive: true });

  const sourcePaths = [];
  for (const dir of sourceDirs) {
    sourcePaths.push(...(await collectPdfPaths(dir)));
  }

  const writtenFrom = new Map(); // destination filename -> source path already copied there
  let copied = 0;
  let renamed = 0;

  for (const srcPath of sourcePaths) {
    let destName = path.basename(srcPath);
    const existingSrcPath = writtenFrom.get(destName);

    if (existingSrcPath) {
      const identical = await filesAreIdentical(path.join(destDir, destName), srcPath);

      if (identical) {
        continue;
      }

      const ext = path.extname(destName);
      const stem = destName.slice(0, -ext.length);
      const label = labelFor ? labelFor(srcPath) : 'alt';
      destName = `${stem}_${label}${ext}`;
      renamed += 1;
      console.warn(
        `Name collision: "${destName}" content differs between "${existingSrcPath}" and "${srcPath}" - writing this one as ${destName}.`
      );
    }

    await fsp.copyFile(srcPath, path.join(destDir, destName));
    writtenFrom.set(destName, srcPath);
    copied += 1;
  }

  return { copied, renamed, total: sourcePaths.length };
}

module.exports = {
  flattenPdfs
};
