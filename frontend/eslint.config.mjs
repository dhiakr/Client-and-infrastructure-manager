import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat();

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...compat.extends("prettier"),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
