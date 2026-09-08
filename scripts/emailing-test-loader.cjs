const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(relative, mocks = {}, cache = new Map()) {
  if (cache.has(relative)) return cache.get(relative).exports;
  const filename = path.join(root, relative), mod = { exports: {} }; cache.set(relative, mod);
  const js = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename })((id) => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/") ? load(id.slice(2) + ".ts", mocks, cache) : require(id), mod, mod.exports);
  return mod.exports;
}
module.exports = { load };
