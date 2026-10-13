// One-click OpenRouter sign-in (OAuth PKCE), so players never paste a key.
// connect() sends them to openrouter.ai to approve; they come back to this
// same page with ?code=..., which finish() trades for a user-owned key that
// stays in this browser. The key then drives the normal OpenAI-compatible
// brain (base https://openrouter.ai/api/v1), with free models by default.
import { settings } from '../settings.js';

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
// a free model with a large context and no credits required; falls back to the
// free router if it is busy or retired
export const FREE_MODELS = ['google/gemma-4-31b-it:free', 'openrouter/free'];
export const FREE_MODEL = FREE_MODELS[0];

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function makeChallenge() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = b64url(bytes.buffer);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

// the page the player returns to (this same URL, without a leftover ?code=)
function callbackUrl() {
  const u = new URL(location.href);
  u.searchParams.delete('code');
  return u.toString();
}

// send the player to OpenRouter to approve; we remember the verifier for the return
export async function connect() {
  const { verifier, challenge } = await makeChallenge();
  try { sessionStorage.setItem('or_verifier', verifier); } catch { /* private mode */ }
  const u = new URL('https://openrouter.ai/auth');
  u.searchParams.set('callback_url', callbackUrl());
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  location.href = u.toString();
}

// did we come back from OpenRouter with an authorization code?
export function pendingCode() {
  try { return new URL(location.href).searchParams.get('code'); } catch { return null; }
}

function clearCode() {
  try {
    const u = new URL(location.href);
    u.searchParams.delete('code');
    history.replaceState(null, '', u.toString());
  } catch { /* ignore */ }
}

// trade the returned code for a key and store it; returns true on success
export async function finish() {
  const code = pendingCode();
  if (!code) return false;
  let verifier = '';
  try { verifier = sessionStorage.getItem('or_verifier') || ''; } catch { /* ignore */ }
  clearCode();
  try { sessionStorage.removeItem('or_verifier'); } catch { /* ignore */ }
  try {
    const res = await fetch(OPENROUTER_BASE.replace('/api/v1', '/api/v1/auth/keys'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || !data.key) return false;
    settings.set('ai.provider', 'openrouter');
    settings.set('ai.base', OPENROUTER_BASE);
    settings.set('ai.key', data.key);
    if (!settings.get('ai.model')) settings.set('ai.model', FREE_MODEL);
    return true;
  } catch { return false; }
}

export function connected() {
  return settings.get('ai.provider') === 'openrouter' && !!settings.get('ai.key');
}

export function disconnect() {
  settings.set('ai.key', '');
  settings.set('ai.provider', 'none');
}
