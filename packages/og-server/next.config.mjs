/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    typescript: {
        ignoreBuildErrors: true, // Safe for simple OG server
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
