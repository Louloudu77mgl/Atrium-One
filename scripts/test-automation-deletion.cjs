const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup() {
  const files = new Map();
  const bucket = {
    upload: async (path, body) => { files.set(path, body.toString()); return { error: null }; },
    download: async (path) => ({ data: files.has(path) ? { text: async () => files.get(path) } : null }),
    remove: async (paths) => { paths.forEach((path) => files.delete(path)); return { error: null }; },
    list: async (prefix) => ({ data: [...files.keys()].filter((path) => path.startsWith(prefix + '/')).map((path) => ({ name: path.slice(prefix.length + 1) })), error: null })
  };
  const supabase = { storage: { getBucket: async () => ({ data: {} }), from: () => bucket } };
  const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/automation-execution-store.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const mockedRequire = (name) => name === '@/lib/supabase/admin' ? { createSupabaseAdminClient: () => supabase, hasSupabaseAdminEnv: () => true } : require(name);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(mockedRequire, module, module.exports);
  return { store: module.exports, files };
}
const flow = (id) => ({ id, title: id, nodes: [], edges: [], status: 'paused', updatedAt: '2026-09-07T00:00:00Z' });
test('deleting all flows persists an empty list and markers for default flows', async () => {
  const { store } = setup();
  for (const id of ['existing-reviews', 'existing-instagram', 'custom']) await store.saveStoredAutomationFlow('owner', flow(id));
  for (const id of ['existing-reviews', 'existing-instagram', 'custom']) await store.deleteStoredAutomationFlow('owner', id);
  assert.deepEqual(await store.listStoredAutomationFlows('owner'), []);
  assert.equal((await store.listDeletedAutomationFlowIds('owner')).length, 3);
});
test('deletion is scoped to the merchant and leaves unselected flows intact', async () => {
  const { store } = setup();
  for (const merchant of ['owner', 'other']) for (const id of ['selected', 'keep']) await store.saveStoredAutomationFlow(merchant, flow(id));
  await store.deleteStoredAutomationFlow('owner', 'selected');
  assert.deepEqual((await store.listStoredAutomationFlows('owner')).map((item) => item.id), ['keep']);
  assert.equal((await store.listStoredAutomationFlows('other')).length, 2);
});
test('a delayed autosave cannot restore a deleted automation or execute its flow', async () => {
  const { store, files } = setup();
  await store.saveStoredAutomationFlow('owner', flow('selected'));
  const original = files.get('merchants/owner/flows/selected.json');
  await store.deleteStoredAutomationFlow('owner', 'selected');
  await assert.rejects(store.saveStoredAutomationFlow('owner', flow('selected')), /supprimée/);
  files.set('merchants/owner/flows/selected.json', original);
  assert.deepEqual(await store.listStoredAutomationFlows('owner'), []);
});
test('deleting an unsaved default flow still prevents it returning', async () => {
  const { store } = setup();
  await store.deleteStoredAutomationFlow('owner', 'existing-welcome');
  assert.deepEqual(await store.listDeletedAutomationFlowIds('owner'), ['existing-welcome']);
  await store.deleteStoredAutomationFlow('owner', 'existing-welcome');
  assert.deepEqual(await store.listDeletedAutomationFlowIds('owner'), ['existing-welcome']);
});
