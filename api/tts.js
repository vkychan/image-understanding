export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server API key not configured' });

  // TTS models have a character limit — truncate to stay safe
  const truncated = text.slice(0, 500);

  let upstream;
  try {
    upstream = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-DataInspection': 'disable'
      },
      body: JSON.stringify({
        model: 'qwen3-tts',
        input: truncated,
        voice: 'Cherry'
      })
    });
  } catch (err) {
    return res.status(502).json({ error: 'TTS network error: ' + err.message });
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    return res.status(upstream.status).json({
      error: `TTS API error ${upstream.status}`,
      message: errText.slice(0, 300)
    });
  }

  const contentType = upstream.headers.get('Content-Type') || 'audio/mpeg';
  const buffer = await upstream.arrayBuffer();
  res.setHeader('Content-Type', contentType);
  return res.status(200).send(Buffer.from(buffer));
}
