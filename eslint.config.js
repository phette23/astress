import js from '@eslint/js'
import jsdoc from 'eslint-plugin-jsdoc'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    plugins: {
      jsdoc,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
      semi: ["warn", "never"],
      'jsdoc/require-jsdoc': ['warn', {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
        },
      }],
    },
  },
  {
    ignores: ['node_modules/**', '.notes/**'],
  },
]
