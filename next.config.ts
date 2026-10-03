import os from 'node:os';
import path from 'node:path';
import type { NextConfig } from 'next';
import packageJson from './package.json' with { type: 'json' };

function getLocalIPv4() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return undefined;
}

const localIp = getLocalIPv4();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  allowedDevOrigins: localIp ? [localIp, `${localIp}:3000`] : [],
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
