import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { getGoogleBusinessLocations } from '../lib/google-business-profile.ts';

test('missing Business permission explicitly requires renewed consent', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: { message: 'Request had insufficient authentication scopes.', details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } }, { status: 403 });
  try { await assert.rejects(getGoogleBusinessLocations('token'), /Autorisation Google Business manquante.*Reconnecter Google/); }
  finally { globalThis.fetch = original; }
});

test('a Google refusal is not silently reported as an empty location list', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? Response.json({ accounts: [{ name: 'accounts/1' }] })
    : Response.json({ error: { message: 'Permission denied' } }, { status: 403 });
  try { await assert.rejects(getGoogleBusinessLocations('token'), /refusé/); }
  finally { globalThis.fetch = original; }
});

test('Google location resources retain their owning account', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? Response.json({ accounts: [{ name: 'accounts/1' }] })
    : Response.json({ locations: [{ name: 'locations/2', title: 'RIZLN' }] });
  try { assert.equal((await getGoogleBusinessLocations('token'))[0].locationId, 'accounts/1/locations/2'); }
  finally { globalThis.fetch = original; }
});

test('the selection page renews the stored Google token before listing locations', async () => {
  const source = readFileSync(new URL('../app/settings/google-business/select-location/page.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const calls = [];
  const dependencies = {
    'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
    'next/navigation': { redirect: () => { throw new Error('Unexpected redirect'); } },
    '@/lib/google-oauth': { getTemporaryGoogleTokens: async () => ({ accessToken: 'expired-temporary-token' }) },
    '@/lib/google-business-connect': {},
    '@/lib/google-connections': { getGoogleConnection: async () => ({ access_token_encrypted: 'expired', refresh_token_encrypted: 'refresh' }) },
    '@/lib/google-tokens': { getFreshGoogleAccessToken: async (connection, merchant) => { calls.push([connection.refresh_token_encrypted, merchant.id]); return 'fresh'; } },
    '@/lib/google-business-profile': { getGoogleBusinessLocations: async token => { calls.push(token); return []; } },
    '@/lib/merchants': { getMerchant: async () => ({ id: 'rizln' }) },
    '@/lib/supabase/server': { getCurrentUser: async () => ({ id: 'owner' }) }
  };
  const exports = {};
  new Function('require', 'exports', outputText)(name => {
    if (!(name in dependencies)) throw new Error(name);
    return dependencies[name];
  }, exports);
  await exports.default();
  assert.deepEqual(calls, [['refresh', 'rizln'], 'fresh']);
});
