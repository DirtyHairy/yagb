// Required for f****** VSCode Jest runner

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['./yagb-core/spec/'],
    coveragePathIgnorePatterns: ['./spec/'],
    testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '!**/*+(-full).+(spec|test).[jt]s(x)?'],
    reporters: [
        'default',
        [
            'jest-html-reporter',
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
};
