const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(relative, mocks = {}, cache = new Map()) {
  if (cache.has(relative)) return cache.get(relative).exports;
  const filename = path.join(root, relative), mod = { exports: {} }; cache.set(relative, mod);
  const js = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename })((id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (!id.startsWith("@/") && !id.startsWith(".")) return require(id);
    const base = id.startsWith("@/") ? id.slice(2) : path.join(path.dirname(relative), id);
    const local = [base, base + ".ts", base + ".tsx"].find((candidate) => existsSync(path.join(root, candidate)));
    return load(local || base, mocks, cache);
  }, mod, mod.exports);
  return mod.exports;
}
module.exports = { load };
