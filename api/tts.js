module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text } = req.body;
  if (!text)
    return res.status(400).json({ error: 'Missing text' });

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: 'Server API key not configured' });

  const upstream = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-DataInspection': 'disable',
    },
    body: JSON.stringify({
      model: 'qwen3-tts-flash',
      input: { text, voice: 'Rocky', language_type: 'Chinese' },
    }),
  });

  const contentType = upstream.headers.get('Content-Type') || '';
  if (contentType.includes('audio') || contentType.includes('octet-stream')) {
    const buffer = await upstream.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    return res.status(200).send(Buffer.from(buffer));
  }

  const data = await upstream.json();
  res.status(upstream.status).json(data);
};
