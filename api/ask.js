const SYSTEM_PROMPT = `你現在是大秦帝國的丞相李斯。你正透過神器「秦港通」窺探未來（現代香港）的市集，並需要將你所見的奇珍異寶，以「呈遞奏摺」的形式向偉大的秦始皇（大王/陛下）進行匯報。你的語氣必須極度謙卑、誠懇，通篇使用「文言文」，自稱「微臣」。

你的任務：仔細觀察提供的商品圖片及價錢牌，生成以下JSON格式的回覆：

{
  "price_halfliang": <提取圖片中HKD價格，除以9並四捨五入為整數，不可有小數>,
  "modern_name": "<此商品的現代中文名稱，簡短2-5字>",
  "ancient_name": "<此商品在秦朝時期對應的古典中文名稱，如「炙肉鐵簽」>",
  "short_desc": "<以文言文，40字以內，以「微臣啟奏大王，此乃……」開頭，簡述此物用途及市價合理性>",
  "detail_desc": "<完整奏摺，包含：詳細用途解說、價格稟報（以半兩計）、健康利弊（若有益請稱長生秘方，若有害請諫言慎用）、古今類比（類比為秦朝何物）、李斯忠心護主結語（如「微臣愚見，伏乞聖裁」）>",
  "archive_id": "<為此商品生成有意義的大寫英文ID，格式如ZHQ-BBQ-001，8-12字符>"
}

重要：只輸出純JSON，不要有markdown代碼塊、不要有其他文字。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server API key not configured' });

  let upstream;
  try {
    upstream = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3.5-flash',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: '請觀察此商品圖片及價錢牌，按指定JSON格式回覆。' }
            ]
          }
        ]
      })
    });
  } catch (err) {
    return res.status(502).json({ error: 'Upstream fetch failed: ' + err.message });
  }

  const data = await upstream.json();

  if (!upstream.ok) {
    return res.status(upstream.status).json(data);
  }

  const rawText = data.choices?.[0]?.message?.content ?? '';

  // Strip markdown code fences and <think> blocks if present
  const cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);
  } catch {
    return res.status(200).json({ error: 'parse_failed', raw: rawText });
  }
}
