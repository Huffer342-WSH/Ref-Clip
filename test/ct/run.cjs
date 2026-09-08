const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'refclip-ct-'));
  const workspace = path.join(temporary, 'workspace');
  fs.mkdirSync(workspace);
  try {
    await runTests({
      version: process.env.VSCODE_TEST_VERSION || 'stable',
      vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
      extensionTestsEnv: { ELECTRON_RUN_AS_NODE: undefined },
      extensionDevelopmentPath: path.resolve(__dirname, '../..'),
      extensionTestsPath: path.join(__dirname, 'suite.cjs'),
      launchArgs: [workspace, '--disable-extensions', '--skip-welcome', '--skip-release-notes',
        '--disable-workspace-trust', '--user-data-dir', path.join(temporary, 'user-data'),
        '--extensions-dir', path.join(temporary, 'extensions'),
        ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : [])],
    });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
