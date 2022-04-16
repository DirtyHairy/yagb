/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['./spec/'],
    coveragePathIgnorePatterns: ['./spec/'],
    reporters: [
        'default',
        [
            './node_modules/jest-html-reporter',
            {
                pageTitle: 'Test Report',
                outputPath: 'test_results/jest-report.html',
                includeFailureMsg: true,
                includeSuiteFailure: true,
                includeConsoleLog: true,
                includeObsoleteSnapshots: true,
            },
        ],
    ],
    setupFiles: ['jest-canvas-mock'],
};
