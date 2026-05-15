// scripts/tunnel.mjs
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 5173;

// Use the actual binary, not the shell wrapper
const isWin = process.platform === 'win32';
const cfBin = resolve(
  __dirname,
  isWin
    ? '../node_modules/cloudflared/bin/cloudflared.exe'
    : '../node_modules/cloudflared/bin/cloudflared'
);

console.log('\n');
console.log('  ┌─────────────────────────────────────┐');
console.log('  │             今天吃什么               │');
console.log('  └─────────────────────────────────────┘\n');
console.log('  🔗 正在建立 Cloudflare HTTPS 隧道...\n');

const cf = spawn(cfBin, ['tunnel', '--url', `http://localhost:${PORT}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
  // No shell:true — use the .cmd file directly on Windows
});

let urlShown = false;

function handleOutput(data) {
  const text = data.toString();
  if (!urlShown) {
    const match = text.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
    if (match) {
      urlShown = true;
      const url = match[0];
      console.log(`  ✅ Public IP address: ${url}\n`);
      console.log('  📱 Scan the QR code below with your mobile phone:\n');
      qrcode.generate(url, { small: true });
      console.log('\n  📍 After scanning the QR code, the application will automatically request location permissions.');
      console.log('  🔴 Keep this window open; closing it will disconnect the tunnel.\n');
    }
  }
}

cf.stdout.on('data', handleOutput);
cf.stderr.on('data', handleOutput);

cf.on('error', (err) => {
  console.error('  ❌ cloudflared 启动失败:', err.message);
  console.error('  请确认 node_modules 中有 cloudflared 安装\n');
  process.exit(1);
});

cf.on('exit', (code, signal) => {
  if (signal === 'SIGINT' || signal === 'SIGTERM') return;
  console.log(`\n  ⚠️  隧道进程退出 (code=${code})，3秒后重连...\n`);
  setTimeout(restart, 3000);
});

function restart() {
  // Restart the whole script logic by spawning a new cloudflared
  const cf2 = spawn(cfBin, ['tunnel', '--url', `http://localhost:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  urlShown = false;
  cf2.stdout.on('data', handleOutput);
  cf2.stderr.on('data', handleOutput);
  cf2.on('error', (err) => { console.error('  ❌ 重连失败:', err.message); });
  cf2.on('exit', (code, signal) => {
    if (signal === 'SIGINT' || signal === 'SIGTERM') return;
    console.log(`  ⚠️  再次断开 (code=${code})，3秒后重连...\n`);
    setTimeout(restart, 3000);
  });
  process.on('SIGINT', () => { cf2.kill(); process.exit(0); });
}

process.on('SIGINT', () => {
  console.log('\n  正在关闭隧道...');
  cf.kill();
  process.exit(0);
});
