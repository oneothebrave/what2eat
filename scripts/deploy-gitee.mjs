// scripts/deploy-gitee.mjs
// 一键打包 + 推送到 Gitee Pages
// 用法：npm run deploy
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

const GITEE_URL = 'https://gitee.com/oneothebrave/what2eat.git';
const BRANCH = 'gh-pages';
const SITE_URL = 'https://oneothebrave.gitee.io/what2eat/';

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

console.log('\n');
console.log('  ┌─────────────────────────────────────────┐');
console.log('  │       今天吃什么 → Gitee Pages 部署       │');
console.log('  └─────────────────────────────────────────┘\n');

// ── 第一步：打包 ──────────────────────────────────────────────────────
console.log('  📦 第一步：打包项目...\n');
run('npm run build');
console.log('\n  ✅ 打包完成\n');

// ── 第二步：清理 dist/.git（如果上次部署留下了） ──────────────────────
const distGit = resolve(DIST, '.git');
if (existsSync(distGit)) {
  rmSync(distGit, { recursive: true, force: true });
}

// ── 第三步：在 dist 目录初始化临时 git 仓库并推送 ──────────────────────
console.log('  🚀 第二步：推送到 Gitee Pages...\n');

run('git init', DIST);
run('git checkout -b gh-pages', DIST);
run('git config user.email "deploy@what2eat.app"', DIST);
run('git config user.name "What2Eat Deploy"', DIST);
run('git add -A', DIST);
run(`git commit -m "Deploy: ${new Date().toLocaleString('zh-CN')}"`, DIST);
run(`git push -f ${GITEE_URL} ${BRANCH}`, DIST);

// ── 完成 ──────────────────────────────────────────────────────────────
console.log('\n');
console.log('  ┌─────────────────────────────────────────┐');
console.log('  │             🎉  部署成功！               │');
console.log('  │                                         │');
console.log(`  │  🌐 ${SITE_URL}  │`);
console.log('  │                                         │');
console.log('  │  ⏳ Gitee Pages 更新需 1~3 分钟生效      │');
console.log('  └─────────────────────────────────────────┘\n');
