import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
    // Dit à Next.js où se trouve l'application pour charger next.config.js et .env
    dir: './',
})

const config: Config = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        // Permet à Jest de comprendre vos alias comme '@/components/...'
        '^@/(.*)$': '<rootDir>/$1',
    },
}

export default createJestConfig(config)
