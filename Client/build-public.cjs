const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const marker = path.join(__dirname, 'build', '.hosted-build');
try { fs.unlinkSync(marker); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const result = spawnSync(process.execPath, [require.resolve('react-scripts/bin/react-scripts'), 'build'], {
  cwd: __dirname, stdio: 'inherit', env: { ...process.env, REACT_APP_LOCAL_ONLY: 'false', REACT_APP_HOSTED: 'true' },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
fs.writeFileSync(marker, 'hosted\n');
