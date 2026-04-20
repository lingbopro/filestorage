import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录（ESM 中 __dirname 不可用）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILES_DIR = path.join(__dirname, './files');
const PUBLIC_DIR = path.join(__dirname, './public');
const DIST_DIR = path.join(__dirname, './dist');

// 🔒 安全：HTML 实体转义
function escapeHtml(str) {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, char => map[char]);
}

// 🔒 安全：URL 编码
function encodeUrl(str) {
  return encodeURIComponent(str);
}

// 文件大小格式化
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
}

// 文件图标
function getFileIcon(name) {
  if (name.endsWith('.pdf')) return '📕';
  if (name.endsWith('.zip') || name.endsWith('.rar')) return '🗜️';
  if (name.endsWith('.mp4')) return '🎬';
  if (name.endsWith('.mp3')) return '🎵';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.gif')) return '🖼️';
  if (name.endsWith('.doc') || name.endsWith('.docx')) return '📘';
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) return '📊';
  if (name.endsWith('.ppt') || name.endsWith('.pptx')) return '📽️';
  return '📄';
}

// 📁 递归扫描文件（异步）
async function scanFiles(dir, base = '') {
  const results = { files: [], dirs: [] };
  
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const relPath = base ? `${base}/${item.name}` : item.name;
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        results.dirs.push({ name: item.name, path: relPath });
        const subResult = await scanFiles(fullPath, relPath);
        results.files.push(...subResult.files);
      } else if (!item.name.endsWith('.md')) {
        const stat = await fs.stat(fullPath);
        results.files.push({
          name: item.name,
          path: relPath,
          size: stat.size,
          modified: stat.mtime.toISOString()
        });
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`❌ 扫描目录失败：${dir}`, err.message);
    }
  }
  
  return results;
}

// 🔒 安全：生成 HTML
function generateHTML(data, currentPath = '') {
  const files = data.files.filter(f => {
    const fileDir = path.dirname(f.path);
    return currentPath === '' ? !f.path.includes('/') : fileDir === currentPath;
  });
  
  const dirs = data.dirs.filter(d => {
    return currentPath === '' ? !d.path.includes('/') : d.path.startsWith(currentPath + '/');
  });
  
  const currentDirs = dirs.filter(d => {
    const parent = path.dirname(d.path);
    return parent === currentPath;
  });

  const breadcrumbs = currentPath ? currentPath.split('/').map((p, i, arr) => {
    const pPath = arr.slice(0, i + 1).join('/');
    return `<a href="${pPath === currentPath ? '' : encodeUrl(pPath) + '/'}">${escapeHtml(p)}</a>`;
  }).join(' / ') : '🏠 首页';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文件托管站 - ${escapeHtml(currentPath || '首页')}</title>
  <link rel="icon" href="/favicon.ico">
  <style>
    :root { --primary: #007bff; --bg: #f8f9fa; --border: #dee2e6; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: var(--bg); padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.08); padding: 30px; }
    header { margin-bottom: 20px; }
    h1 { font-size: 1.5rem; color: #222; margin-bottom: 10px; }
    .breadcrumb { color: #666; font-size: 14px; }
    .breadcrumb a { color: var(--primary); text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .item-list { list-style: none; }
    .item { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid var(--border); }
    .item:hover { background: #f8f9fa; }
    .item:last-child { border-bottom: none; }
    .item-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .item-icon { font-size: 18px; }
    .item-name { color: var(--primary); text-decoration: none; font-weight: 500; word-break: break-all; }
    .item-name:hover { text-decoration: underline; }
    .item-meta { font-size: 13px; color: #666; text-align: right; white-space: nowrap; margin-left: 10px; }
    .back-link { display: inline-block; margin-bottom: 15px; color: var(--primary); text-decoration: none; }
    .empty { text-align: center; padding: 40px; color: #999; }
    footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border); color: #888; font-size: 14px; }
    @media (max-width: 600px) { .item { flex-direction: column; align-items: flex-start; gap: 8px; } .item-meta { text-align: left; margin-left: 32px; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📁 文件托管站</h1>
      <div class="breadcrumb">${breadcrumbs}</div>
    </header>
    
    ${currentPath ? `<a href="../" class="back-link">⬅️ 返回上级</a>` : ''}
    
    <ul class="item-list">
      ${currentDirs.map(d => `
        <li class="item">
          <div class="item-left">
            <span class="item-icon">📁</span>
            <a href="${encodeUrl(d.path)}/" class="item-name">${escapeHtml(d.name)}</a>
          </div>
          <div class="item-meta">目录</div>
        </li>
      `).join('')}
      
      ${files.map(f => `
        <li class="item">
          <div class="item-left">
            <span class="item-icon">${getFileIcon(f.name)}</span>
            <a href="/files/${encodeUrl(f.path)}" class="item-name" download>${escapeHtml(f.name)}</a>
          </div>
          <div class="item-meta">${formatSize(f.size)} · ${new Date(f.modified).toLocaleDateString()}</div>
        </li>
      `).join('')}
    </ul>
    
    ${currentDirs.length + files.length === 0 ? '<div class="empty">📭 此目录为空</div>' : ''}
    
    <footer>
      静态文件托管 · 共 ${data.files.length} 个文件
    </footer>
  </div>
  
  <script>
    function formatSize(b) {
      if (!b || b === 0) return '0 B';
      const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(b) / Math.log(k));
      return (b / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
    }
    function getFileIcon(name) {
      if (name.endsWith('.pdf')) return '📕';
      if (name.endsWith('.zip') || name.endsWith('.rar')) return '🗜️';
      if (name.endsWith('.mp4')) return '🎬';
      if (name.endsWith('.mp3')) return '🎵';
      if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.gif')) return '🖼️';
      if (name.endsWith('.doc') || name.endsWith('.docx')) return '📘';
      if (name.endsWith('.xls') || name.endsWith('.xlsx')) return '📊';
      return '📄';
    }
  </script>
</body>
</html>`;
}

// 📁 复制 public/ 下的额外静态文件（异步）
async function copyPublicFiles() {
  try {
    await fs.access(PUBLIC_DIR);
  } catch {
    console.log('⚠️ 未找到 public/ 目录，跳过额外文件');
    return 0;
  }
  
  let count = 0;
  
  async function copyDir(src, dst) {
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      
      if (entry.isDirectory()) {
        await fs.mkdir(dstPath, { recursive: true });
        await copyDir(srcPath, dstPath);
      } else {
        await fs.mkdir(path.dirname(dstPath), { recursive: true });
        await fs.copyFile(srcPath, dstPath);
        count++;
      }
    }
  }
  
  await copyDir(PUBLIC_DIR, DIST_DIR);
  return count;
}

// 📦 复制托管文件（异步）
async function copyFilesDir() {
  try {
    await fs.access(FILES_DIR);
    await fs.cp(FILES_DIR, path.join(DIST_DIR, 'files'), { recursive: true });
    console.log('✅ 托管文件复制完成');
  } catch {
    console.log('⚠️ 未找到 files/ 目录，跳过托管文件');
  }
}

// 主函数
async function build() {
  console.log('🔍 扫描文件...');
  const data = await scanFiles(FILES_DIR);
  console.log(`✅ 发现 ${data.files.length} 个文件，${data.dirs.length} 个目录`);
  
  // 清理并创建 dist 输出目录
  console.log('🧹 清理输出目录...');
  try {
    await fs.rm(DIST_DIR, { recursive: true, force: true });
  } catch {}
  await fs.mkdir(DIST_DIR, { recursive: true });
  
  // 复制托管文件
  console.log('📦 复制托管文件...');
  await copyFilesDir();
  
  // 📁 复制 public/ 下的额外静态文件
  console.log('📦 复制额外文件 (public/) ...');
  const extraCount = await copyPublicFiles();
  console.log(`✅ 复制 ${extraCount} 个额外文件`);
  
  // 生成首页
  console.log('📝 生成首页...');
  await fs.writeFile(path.join(DIST_DIR, 'index.html'), generateHTML(data));
  
  // 为每个目录生成页面
  console.log('📝 生成目录页面...');
  const allDirs = new Set(['']);
  data.files.forEach(f => {
    let p = path.dirname(f.path);
    while (p && p !== '.') {
      allDirs.add(p);
      p = path.dirname(p);
    }
  });
  
  const dirPromises = [];
  for (const dir of allDirs) {
    if (dir === '') continue;
    const dirPath = path.join(DIST_DIR, dir);
    dirPromises.push(
      fs.mkdir(dirPath, { recursive: true })
        .then(() => fs.writeFile(path.join(dirPath, 'index.html'), generateHTML(data, dir)))
    );
  }
  await Promise.all(dirPromises);
  
  console.log('🎉 构建完成！输出目录：dist/');
}

// 执行构建
build().catch(err => {
  console.error('❌ 构建失败:', err);
  process.exit(1);
});