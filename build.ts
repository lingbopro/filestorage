#!/usr/bin/env -S pnpm exec tsx
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, 'dist');
const filesPath = path.join(__dirname, 'files');
const publicPath = path.join(__dirname, 'public');

const baseURL = '/';

function escapeHtml(str: string): string {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (char) => map[char]);
}
function encodeUrl(str: string): string {
  return encodeURIComponent(str).replace('%2F', '/');
}
function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024,
    s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
}

interface FileInfo {
  name: string;
  relPath: string;
  stat: fs.Stats;
}

function generateHTML(
  relPath: string,
  files: FileInfo[],
  dirs: string[]
): string {
  const pathList = relPath.split('/');
  const breadcrumbs = pathList
    .map(
      (value, index) =>
        `<a href="${encodeUrl(path.posix.join(baseURL, pathList.slice(0, index + 1).join('/')))}">${escapeHtml(index === 0 ? 'lingbopro\'s file storage' : value)}</a>`
    )
    .join(' / ');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(`lingbopro's file storage • ${relPath}`)}</title>
  <link rel="stylesheet" href="${path.posix.join(baseURL, 'index.css')}">
  <link rel="icon" href="${path.posix.join(baseURL, 'favicon.ico')}">
</head>
<body>
  <div class="container">
    <header>
      <div class="breadcrumb">${breadcrumbs}</div>
    </header>
    ${relPath != '/' ? `<a href="../" class="back-link">⬅️ 上级目录</a>` : ''}

    <ul class="item-list">
${dirs
  .map(
    (d) => `
        <li class="item">
          <div class="item-left">
            <span class="item-icon">📁</span>
            <a href="${encodeUrl(path.posix.join(baseURL, relPath, d))}/" class="item-name">${escapeHtml(d)}</a>
          </div>
        </li>`
  )
  .join('')}
${files
  .map(
    (f) => `
        <li class="item">
          <div class="item-left">
            <span class="item-icon">📄</span>
            <a href="/_files${encodeUrl(path.posix.join(baseURL, f.relPath))}" class="item-name">${escapeHtml(f.name)}</a>
          </div>
          <div class="item-meta">
            <span class="item-size">${formatSize(f.stat.size)}</span> |
            <a class="download-link" href="/_files/${encodeUrl(path.posix.join(baseURL, f.relPath))}" download>下载</a>
          </div>
        </li>`
  )
  .join('')}
    </ul>

    <footer>
      共 ${files.length + dirs.length} 个项目
    </footer>
  </div>

  <script>
    console.log('Hello World!')
  </script>
</body>
</html>`;
  return html;
}

async function processDir(relPath: string) {
  console.log(`Processing: ${relPath}`);
  const absDirPath = path.join(filesPath, relPath);
  const entries = await fsp.readdir(absDirPath);
  const files: FileInfo[] = [];
  const dirs: string[] = [];
  for (let filename of entries) {
    const absPath = path.join(absDirPath, filename);
    const stat = await fsp.stat(absPath);
    if (stat.isDirectory()) {
      dirs.push(filename);
      await processDir(path.posix.join(relPath, filename));
    } else {
      files.push({
        name: filename,
        relPath: path.posix.join(relPath, filename),
        stat,
      });
    }
  }
  const html = generateHTML(relPath, files, dirs);
  const htmlPath = path.join(distPath, relPath);
  if (!fs.existsSync(htmlPath)) {
    await fsp.mkdir(htmlPath, { recursive: true });
  }
  await fsp.writeFile(path.join(htmlPath, 'index.html'), html);
}

async function main() {
  if (fs.existsSync(distPath)) {
    await fsp.rm(distPath, { recursive: true });
  }
  await fsp.mkdir(distPath);

  console.log('Copying files...');
  await fsp.cp(filesPath, path.join(distPath, '_files'), { recursive: true });

  console.log('Start processing static pages...');
  await processDir('/');

  console.log('Copying public files...');
  for (let p of await fsp.readdir(publicPath)) {
    if ((await fsp.stat(path.join(publicPath, p))).isDirectory()) {
      await fsp.cp(path.join(publicPath, p), path.join(distPath, p));
    } else {
      await fsp.copyFile(path.join(publicPath, p), path.join(distPath, p));
    }
  }
  console.log('Complete!');
}

console.time('build');
main().then(() => {
  console.timeEnd('build');
});
