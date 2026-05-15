import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skills/templates: archivos de documentación con código de muestra
    // intencionalmente incompleto (referencias a componentes no definidos,
    // patrones que ilustran "qué hacer / qué evitar").
    ".claude/**",
    // Coverage output: artefacto generado por vitest --coverage, no es código
    // del proyecto y suele incluir directivas eslint-disable propias.
    "coverage/**",
  ]),
  {
    rules: {
      // Permite prefijo `_` para vars intencionalmente sin uso (destructuring
      // skip, callbacks con args ignorados, etc.). Coherente con CLAUDE.md
      // §14 y el patrón `const { id: _, ...rest } = obj`.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // React Compiler avisa que `react-hook-form` (watch/setValue) y
      // `@tanstack/react-table` (useReactTable) devuelven funciones no
      // memoizables. Son librerías estándar y compatibles — el compiler
      // simplemente decide no memoizar esos componentes ("Compilation
      // Skipped"), pero no hay bug real ni problema de rendimiento. El
      // warning es ruido permanente para nuestro stack. Desactivamos.
      "react-hooks/incompatible-library": "off",
    },
  },
]);

export default eslintConfig;
