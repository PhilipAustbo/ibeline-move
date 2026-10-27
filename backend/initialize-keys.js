// One-time setup after deploying. Private keys go straight to Wrangler's stdin.
import { spawnSync } from 'node:child_process';
import webpush from 'web-push';
const url=process.argv[2];
if(!url||!/^https:\/\/[a-z0-9.-]+\.workers\.dev\/?$/.test(url))throw new Error('Oppgi Worker-URL-en fra publiseringen.');
const config=await fetch(`${url.replace(/\/$/,'')}/config`).then(r=>r.json());
if(config.ready){console.log('Signeringsnøkler finnes allerede. Beholder eksisterende abonnementer.');process.exit(0);}
const keys=webpush.generateVAPIDKeys();
const wrangler=new URL('./node_modules/wrangler/bin/wrangler.js',import.meta.url);
const result=spawnSync(process.execPath,[wrangler.pathname,'secret','bulk'],{
  cwd:new URL('.',import.meta.url),input:JSON.stringify({VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey}),encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}
});
if(result.status!==0){console.error('Kunne ikke lagre signeringsnøkler i Cloudflare. Kontroller innloggingen og prøv igjen.');process.exit(1);}
console.log('Signeringsnøkler er lagret som Cloudflare-secrets. Ingen private nøkler er skrevet til disk eller konsollen.');
