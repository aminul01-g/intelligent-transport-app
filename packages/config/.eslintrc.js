module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./apps/*/tsconfig.json', './packages/*/tsconfig.json'],
    tsconfigRootDir: require('path').resolve(__dirname, '../..')
  },
  ignorePatterns: [
    '**/dist/**',
    '**/.next/**',
    '**/node_modules/**',
    'next.config.mjs',
    '.eslintrc.js',
    '**/public/sw.js',
    '**/infra/scripts/**',
    '**/infra/migrations/**'
  ],
  plugins: [
    '@typescript-eslint',
    'import'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'airbnb-base',
    'airbnb-typescript/base'
  ],
  rules: {
    // TypeScript strict constraints
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-module-boundary-types": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-unused-vars": "off",
    
    // Import rules alignment
    "import/extensions": "off",
    "import/no-extraneous-dependencies": "off",
    "import/prefer-default-export": "off",
    
    // Coding style & preferences
    "max-len": ["error", { "code": 120, "ignoreComments": true }],
    "no-console": "off",
    "class-methods-use-this": "off"
  },
  settings: {
    "import/resolver": {
      "typescript": {
        "alwaysTryTypes": true
      }
    }
  }
};
