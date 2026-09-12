import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, symlink, link, rm, realpath, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { canonicalLocale, loadCatalogs, parseCatalogJson, REPOSITORY_ROOT } from "../scripts/catalogs.mjs";
import { prepareLocales, renderLocaleRegistry } from "../scripts/prepare-locales.mjs";
import { applyExactOverlay, EXACT_EDITS, TEMPLATE_TARGETS } from "../runtime/overlays.mjs";
import { assertValidLocaleMessages, validateLocaleMessages } from "../runtime/locale-validation.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "community-catalog-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "locales"));
  return root;
}
async function catalog(root, locale, messages) {
  await writeFile(path.join(root, "locales", `${locale}.json`), JSON.stringify(messages, null, 2));
}
function messages(locale) {
  const text = { en: "Item", ru: "Элемент", ar: "عنصر" }[locale];
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  return {
    common: { title: text, hello: `${text} {{name}}`, html: `<0>${text}</0><br/>` },
    ...Object.fromEntries(categories.map((category) => [`items_${category}`, `${text} {{count}}`])),
    invariant_other: `${text} {{count}}`,
  };
}

test("real community catalogs pass structural validation", async () => {
  const catalogs = await loadCatalogs();
  assert.equal(catalogs[0].locale, "en");
  assert.ok(catalogs.some(({ locale }) => locale === "ru"));
});

test("adding only a third JSON file enables all its CLDR forms in generated registration", async (t) => {
  const root = await fixture(t);
  for (const locale of ["ru", "ar", "en"]) await catalog(root, locale, messages(locale));
  const catalogs = await loadCatalogs(root);
  assert.deepEqual(catalogs.map(({ locale }) => locale), ["en", "ar", "ru"]);
  const template = await readFile(path.join(REPOSITORY_ROOT, "runtime/locales.ts.template"), "utf8");
  const source = renderLocaleRegistry(template, catalogs);
  assert.match(source, /import catalog1 from "\.\/locales\/ar\.json"/);
  assert.doesNotMatch(source, /import\.meta\.glob|require\.context|locales\/fr\.json/);
  // Execute the generated registry itself with fixture imports, using Node's TS
  // erasure. Runtime validation remains the real dependency-free validator.
  globalThis.__communityCatalogAssert = assertValidLocaleMessages;
  t.after(() => { delete globalThis.__communityCatalogAssert; });
  const executable = source
    .replace('import { assertValidLocaleMessages } from "./locale-validation";', 'const assertValidLocaleMessages = globalThis.__communityCatalogAssert;')
    .replace(/import catalog(\d+) from "\.\/locales\/[^"\n]+\.json";/g,
      (_line, index) => `const catalog${index} = ${JSON.stringify(catalogs[Number(index)].messages)};`);
  const registry = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(executable, { mode: "strip" }))}`);
  assert.equal(registry.DEFAULT_LOCALE, "en");
  assert.deepEqual([...registry.supportedLocales], ["en", "ar", "ru"]);
  assert.equal(registry.isSupportedLocale("ar"), true);
  assert.equal(registry.isSupportedLocale("fr"), false);
  assert.equal(registry.localeAutonym("ar"), new Intl.DisplayNames(["ar"], { type: "language" }).of("ar"));
  for (const locale of ["en", "ar", "ru"]) {
    for (const category of new Intl.PluralRules(locale).resolvedOptions().pluralCategories) {
      assert.equal(registry.i18nextResources[locale].translation[`invariant_${category}`], messages(locale).invariant_other);
      assert.equal(registry.i18nextResources[locale].translation[`items_${category}`], messages(locale)[`items_${category}`]);
    }
  }
});

test("a scaffold is rejected for missing message coverage", async (t) => {
  const root = await fixture(t);
  await catalog(root, "en", messages("en"));
  await catalog(root, "ar", { common: { title: "عنصر" } });
  await assert.rejects(loadCatalogs(root), /is missing/);
});

test("missing English, malformed plurals, extra keys, and non-string messages fail", async (t) => {
  const root = await fixture(t);
  await catalog(root, "ru", messages("ru"));
  await assert.rejects(loadCatalogs(root), /Missing required English/);
  await catalog(root, "en", messages("en"));
  const russian = messages("ru");
  delete russian.items_few;
  await catalog(root, "ru", russian);
  await assert.rejects(loadCatalogs(root), /items_few is missing/);
  await catalog(root, "ru", { ...messages("ru"), items_typo: "{{count}}" });
  await assert.rejects(loadCatalogs(root), /items_typo is not defined/);
  await catalog(root, "ru", { ...messages("ru"), items_many: 2 });
  await assert.rejects(loadCatalogs(root), /string leaves/);
});

test("placeholder multiplicity, malformed interpolation, markup structure, URLs and lengths are validated", () => {
  const reference = { text: "Hello {{name}} {{name}}", rich: "<0>Open</0><br/>", plain: "Open" };
  for (const value of ["Hi {{name}}", "Hi {{other}} {{other}}", "Hi {{name}} {{name}} {{- name}}", "Hi {{name}} {{name}} {{"]) {
    assert.ok(validateLocaleMessages({ ...reference, text: value }, reference).length > 0, value);
  }
  for (const value of ["<1>Open</1><br/>", "<0 onclick='evil()'>Open</0><br/>", "<0><br/>Open"]) {
    assert.ok(validateLocaleMessages({ ...reference, rich: value }, reference).length > 0, value);
  }
  for (const value of ["<script>alert(1)</script>", "javascript:alert(1)", "data:text/html,bad", "https://evil.invalid", "<b>Open</b>", "x".repeat(250)]) {
    assert.ok(validateLocaleMessages({ ...reference, plain: value }, reference).length > 0, value);
  }
  assert.deepEqual(validateLocaleMessages({ text: "<0>{{name}}</0> <strong>Открыть</strong>" }, { text: "<strong>Open</strong> <0>{{name}}</0>" }), []);
  assert.deepEqual(validateLocaleMessages({ text: "Пример <имя папки>" }, { text: "Example <folder name>" }), []);
});

test("JSON safety rejects duplicate/unsafe keys, trailing content, arrays, nulls, blank strings and deep nesting", () => {
  for (const input of [
    '{"x":"a","x":"b"}', '{"a":{"x":"a","\\u0078":"b"}}',
    '{"__proto__":{"x":"y"}}', '{"constructor":"x"}', '{"prototype":"x"}',
    '{"x":null}', '{"x":["a"]}', '{"x":true}', '{"x":""}', '{"x":"   "}',
    '{"x":{}}', '{}', '"not an object"', '{"x":"a",}', '{"x":"a"}true',
    '{"x":"\\u0000"}', '{"x":"\\ud800"}', '{"x":"unterminated}',
    '{"x":'.repeat(35) + '"a"' + '}'.repeat(35),
  ]) assert.throws(() => parseCatalogJson(input), undefined, input);
  assert.equal(parseCatalogJson('{"x":"Text 😀\\nLine"}').x, "Text 😀\nLine");
});

test("catalog filenames must be canonical, supported BCP 47, without extensions or paths", () => {
  for (const filename of ["ru.json", "pt-BR.json", "zh-Hant.json"]) assert.equal(canonicalLocale(filename), filename.slice(0, -5));
  for (const filename of ["../ru.json", "RU.json", "pt-br.json", "en_US.json", "iw.json", "en.json.js", "en-u-ca-gregory.json", "zz.json", "file.json", "README.md"]) {
    assert.throws(() => canonicalLocale(filename), undefined, filename);
  }
});

test("filesystem loader rejects invalid UTF-8, filename aliases, directories and symlink catalogs/ancestors", async (t) => {
  const root = await fixture(t);
  await catalog(root, "en", messages("en"));
  const russian = path.join(root, "locales/ru.json");
  await writeFile(russian, Buffer.from([0xff]));
  await assert.rejects(loadCatalogs(root), /encoded data|encoding/i);
  await rm(russian);
  await symlink(path.join(root, "locales/en.json"), russian);
  await assert.rejects(loadCatalogs(root), /Symlink/);
  await rm(russian);
  await mkdir(russian);
  await assert.rejects(loadCatalogs(root), /regular file/);
  await rm(russian, { recursive: true });
  await catalog(root, "RU", messages("ru"));
  await assert.rejects(loadCatalogs(root), /Noncanonical/);
  await rm(path.join(root, "locales/RU.json"));
  const alias = path.join(root, "alias");
  await symlink(root, alias);
  await assert.rejects(loadCatalogs(alias), /Symlink/);
  await assert.rejects(loadCatalogs("relative/path"), /absolute/);
});

test("audited overlays reject source drift and apply only explicitly counted snippets", () => {
  const source = 'const chosen = "ru";\n// provider string stays intact\n';
  const overlay = { path: "fixture.ts", sha256: createHash("sha256").update(source).digest("hex"), replacements: [{ before: '"ru"', after: '"locale"', count: 1 }] };
  assert.equal(applyExactOverlay(source, overlay), 'const chosen = "locale";\n// provider string stays intact\n');
  assert.throws(() => applyExactOverlay(source + "// drift\n", overlay), /source differs/);
  assert.throws(() => applyExactOverlay(source, { ...overlay, replacements: [{ ...overlay.replacements[0], count: 2 }] }), /expected 2 matches/);
});

test("preparation preflight refuses unexpected or linked target files without mutation", async (t) => {
  const root = await fixture(t);
  await catalog(root, "en", messages("en"));
  const target = path.join(root, "checkout");
  await mkdir(path.join(target, "ui/src/i18n"), { recursive: true });
  const destination = path.join(target, TEMPLATE_TARGETS[0].path);
  await writeFile(destination, "untouched upstream file");
  await assert.rejects(prepareLocales({ root, target }), /source differs/);
  assert.equal(await readFile(destination, "utf8"), "untouched upstream file");
  await rm(destination);
  const outside = path.join(root, "outside.ts");
  await writeFile(outside, "outside");
  await symlink(outside, destination);
  await assert.rejects(prepareLocales({ root, target }), /Symlink/);
  assert.equal(await readFile(outside, "utf8"), "outside");
  await rm(destination);
  await link(outside, destination);
  await assert.rejects(prepareLocales({ root, target }), /Hard-linked/);
  assert.equal(await readFile(outside, "utf8"), "outside");
  await assert.rejects(prepareLocales({ root, target: "relative" }), /absolute/);
  await assert.rejects(prepareLocales({ root, target: root }), /separate disposable/);
});

test("preparation on a reviewed source preserves unrelated files and scaffold catalogs", {
  skip: !process.env.PAPERCLIP_REVIEWED_SOURCE && "Set PAPERCLIP_REVIEWED_SOURCE for integration against the pinned checkout",
}, async (t) => {
  const root = await fixture(t);
  for (const locale of ["en", "ru", "ar"]) await catalog(root, locale, messages(locale));
  const target = path.join(root, "checkout");
  await mkdir(target);
  for (const overlay of [...TEMPLATE_TARGETS, ...EXACT_EDITS]) {
    const destination = path.join(target, overlay.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(process.env.PAPERCLIP_REVIEWED_SOURCE, overlay.path), destination);
  }
  await mkdir(path.join(target, "ui/src/i18n/locales"));
  const scaffold = path.join(target, "ui/src/i18n/locales/fr.json");
  const unrelated = path.join(target, "unrelated.txt");
  await writeFile(scaffold, '{"draft":"unreviewed upstream scaffold"}\n');
  await writeFile(unrelated, "preserve me\n");
  const result = await prepareLocales({ root, target });
  assert.deepEqual(result.locales, ["en", "ar", "ru"]);
  assert.equal(await readFile(scaffold, "utf8"), '{"draft":"unreviewed upstream scaffold"}\n');
  assert.equal(await readFile(unrelated, "utf8"), "preserve me\n");
  assert.doesNotMatch(await readFile(path.join(target, "ui/src/i18n/locales.ts"), "utf8"), /fr\.json/);
  const generatedTests = await readFile(path.join(target, "ui/src/i18n/community-locales.test.tsx"), "utf8");
  assert.match(generatedTests, /resetting a draft/);
  assert.match(generatedTests, /const PREPARED_CATALOG_LOCALES = \["en","ar","ru"\] as const;/);
  const adaptedTests = await readFile(path.join(target, "ui/src/i18n/locale-sync.test.ts"), "utf8");
  assert.match(adaptedTests, /Object\.keys\(localeMessages\)\)\.toEqual\(\[\.\.\.supportedLocales\]\)/);
  assert.match(adaptedTests, /arrayContaining\(\["en", "ru"\]\)/);
  assert.match(adaptedTests, /setLocale\("zz-ZZ"\)/);
  assert.doesNotMatch(adaptedTests, /setLocale\("ar"\)|mockReturnValue\(\["fr-FR"\]\)/);
  assert.equal(result.paths.length, TEMPLATE_TARGETS.length + EXACT_EDITS.length + 1 + 3);
});
