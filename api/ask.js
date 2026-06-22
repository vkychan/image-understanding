module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageUrl, question } = req.body;
  if (!imageUrl || !question)
    return res.status(400).json({ error: 'Missing imageUrl or question' });

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: 'Server API key not configured' });

  const upstream = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-vl-plus',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: question },
        ],
      }],
    }),
  });

  const data = await upstream.json();
  res.status(upstream.status).json(data);
};
