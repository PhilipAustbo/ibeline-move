// One-time setup after deploying. Private keys go straight to Wrangler's stdin.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
const url=process.argv[2];
if(!url||!/^https:\/\/[a-z0-9.-]+\.workers\.dev\/?$/.test(url))throw new Error('Oppgi Worker-URL-en fra publiseringen.');
const wrangler=fileURLToPath(new URL('./node_modules/wrangler/bin/wrangler.js',import.meta.url));
let config;
try {config=await fetch(`${url.replace(/\/$/,'')}/config`,{signal:AbortSignal.timeout(10000)}).then(r=>r.json());}
catch {
  // A fresh workers.dev subdomain can take time to obtain its certificate.
  // Inspect secret names through the authenticated API instead of weakening TLS.
  const inspection=spawnSync(process.execPath,[wrangler,'secret','list'],{cwd:new URL('.',import.meta.url),encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  if(inspection.status!==0)throw new Error('Kan ikke kontrollere eksisterende signeringsnøkler. Prøv igjen senere.');
  const names=JSON.parse(inspection.stdout).map(secret=>secret.name);
  if(names.includes('VAPID_PUBLIC_KEY')!==names.includes('VAPID_PRIVATE_KEY'))throw new Error('Fant et ufullstendig nøkkelpar. Avklar oppsettet før nye nøkler opprettes.');
  config={ready:names.includes('VAPID_PRIVATE_KEY')};
}
if(config.ready){console.log('Signeringsnøkler finnes allerede. Beholder eksisterende abonnementer.');process.exit(0);}
const keys=webpush.generateVAPIDKeys();
const result=spawnSync(process.execPath,[wrangler,'secret','bulk'],{
  cwd:new URL('.',import.meta.url),input:JSON.stringify({VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey}),encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}
});
if(result.status!==0){console.error('Kunne ikke lagre signeringsnøkler i Cloudflare. Kontroller innloggingen og prøv igjen.');process.exit(1);}
console.log('Signeringsnøkler er lagret som Cloudflare-secrets. Ingen private nøkler er skrevet til disk eller konsollen.');
