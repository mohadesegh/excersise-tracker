// POST /functions/v1/tts  { text, lang? }  →  audio/mpeg (neural voice for fa-IR, tr-TR or en-US; Persian by default)
// Secrets: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (e.g. westeurope).
// The app caches every phrase on the device, so each cue is synthesised once per user.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const VOICES: Record<string, string> = {
  'fa-IR': Deno.env.get('AZURE_VOICE') ?? 'fa-IR-DilaraNeural', // or fa-IR-FaridNeural (male)
  'tr-TR': Deno.env.get('AZURE_VOICE_TR') ?? 'tr-TR-EmelNeural',
  'en-US': Deno.env.get('AZURE_VOICE_EN') ?? 'en-US-JennyNeural',
};
const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const { text, lang: asked } = await req.json().catch(() => ({ text: '' }));
  const lang = typeof asked === 'string' && asked in VOICES ? asked : 'fa-IR';
  if (typeof text !== 'string' || !text.trim() || text.length > 300) return new Response('bad text', { status: 400, headers: cors });

  const region = Deno.env.get('AZURE_SPEECH_REGION');
  const key = Deno.env.get('AZURE_SPEECH_KEY');
  if (!region || !key) return new Response('tts not configured', { status: 501, headers: cors });

  const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${VOICES[lang]}"><prosody rate="+4%">${esc(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'varzideh',
    },
    body: ssml,
  });
  if (!res.ok) return new Response(`tts failed ${res.status}`, { status: 502, headers: cors });
  return new Response(res.body, { headers: { ...cors, 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000' } });
});
