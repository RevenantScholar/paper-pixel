import fs from "node:fs";
import path from "node:path";
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}
const requirements = new Set(
  files("docs/intent")
    .filter((p) => p.endsWith("-specs.md"))
    .flatMap((p) =>
      [...fs.readFileSync(p, "utf8").matchAll(/\*\*([A-Z]+-\d+)\*\*/g)].map(
        (m) => m[1],
      ),
    ),
);
const annotations = (dir) =>
  files(dir)
    .filter((p) => /\.(ts|tsx)$/.test(p))
    .flatMap((p) =>
      fs
        .readFileSync(p, "utf8")
        .split("\n")
        .filter((l) => l.includes("@spec"))
        .flatMap((l) =>
          [...l.matchAll(/\b[A-Z]+-\d+\b/g)].map((m) => ({
            id: m[0],
            file: p,
          })),
        ),
    );
const tests = [...annotations("tests"), ...annotations("e2e")],
  code = annotations("src");
const unknown = [...tests, ...code].filter((a) => !requirements.has(a.id));
const missingTests = [...requirements].filter(
  (id) => !tests.some((a) => a.id === id),
);
const missingCode = [...requirements].filter(
  (id) => !code.some((a) => a.id === id),
);
console.log(
  `${requirements.size} requirements; ${new Set(tests.map((a) => a.id)).size} test-linked; ${new Set(code.map((a) => a.id)).size} code-linked.`,
);
if (unknown.length || missingTests.length || missingCode.length) {
  console.error({ unknown, missingTests, missingCode });
  process.exitCode = 1;
}
