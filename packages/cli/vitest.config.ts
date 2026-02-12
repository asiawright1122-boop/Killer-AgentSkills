import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        globals: true,
        testTimeout: 30000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts']
        }
    },
    resolve: {
        alias: {
            '@': '/src'
        }
    }
});
