import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("password complexity errors are translated into clear Persian guidance", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /function getPersianAuthError\(error: unknown\): string/);
  assert.match(source, /حروف انگلیسی کوچک/);
  assert.match(source, /حروف بزرگ/);
  assert.match(source, /حداقل یک عدد/);
  assert.match(source, /حداقل یک علامت/);
  assert.match(source, /setAuthMessage\(getPersianAuthError\(error\)\)/);
});

test("workspace form and content drafts are restored and autosaved without storing credentials", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /WORKSPACE_DRAFT_KEY/);
  assert.match(source, /window\.localStorage\.getItem\(storageKey\)/);
  assert.match(source, /window\.localStorage\.setItem\(storageKey, JSON\.stringify\(/);
  assert.match(source, /addEventListener\("pagehide", saveDraft\)/);
  assert.match(source, /addEventListener\("visibilitychange", saveDraft\)/);
  assert.match(source, /product,\s*content,\s*activeTab,\s*draftText,\s*brandProfile/);
  assert.doesNotMatch(source.match(/window\.localStorage\.setItem\(storageKey, JSON\.stringify\(([\s\S]*?)\)\);/)?.[1] || "", /authPassword|deleteAccountPassword|newPassword/);
  assert.match(source, /workspaceDraftLoadedKey !== storageKey/);
});


test("auth token refreshes do not clear history or trigger a false empty state", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const authUserIdRef = useRef<string \| null>\(null\)/);
  assert.match(source, /const identityChanged = authUserIdRef\.current !== nextUserId/);
  assert.match(source, /if \(identityChanged\) \{/);
  assert.doesNotMatch(source, /if \(event !== "USER_UPDATED"\) \{[\s\S]{0,100}setHistory\(\[\]\)/);
});

test("password policy translations cover provider wording variants", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /lower case\|uppercase\|upper case/);
  assert.match(source, /digit\|symbol\|special/);
  assert.match(source, /isPasswordPolicyError/);
});
