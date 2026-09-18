import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Architecture boundaries (TECHNICAL_SPEC §2.2): UI never talks to Supabase directly.
// Database → lib/repositories · Realtime → hooks/useRoomChannel · Storage → lib/storage
const supabaseBoundary = {
  patterns: [
    {
      group: ["@supabase/*", "@/lib/supabase/*"],
      message:
        "UI must not import Supabase. Use lib/repositories (DB), hooks/useRoomChannel (Realtime) or lib/storage (files).",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["components/**/*.{ts,tsx}", "app/**/page.tsx", "app/**/layout.tsx"],
    rules: {
      "no-restricted-imports": ["error", supabaseBoundary],
    },
  },
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "supabase/.temp/**"]),
]);

export default eslintConfig;
