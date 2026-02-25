import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '150mb',
        },
    },
    turbopack: {
        resolveAlias: {
            canvas: './empty-module.ts',
            encoding: './empty-module.ts',
        },
    },
};

export default nextConfig;
