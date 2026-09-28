// api/chat.js
// Vercel serverless function — Gemini API proxy
// Set GEMINI_API_KEY in Vercel Environment Variables

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel Environment Variables' });
  }

  const { system, contents } = req.body || {};
  if (!system || !contents) {
    return res.status(400).json({ error: 'Missing system or contents' });
  }

  // Support both AQ. (OAuth Bearer) and AIza (API key) formats
  const isOAuth = geminiKey.startsWith('AQ.');
  const url = isOAuth
    ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
    : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

  const headers = { 'Content-Type': 'application/json' };
  if (isOAuth) headers['Authorization'] = `Bearer ${geminiKey}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 300,
          topP: 0.95
        }
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return res.status(upstream.status).json({ error: data?.error?.message || 'Gemini API error' });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(502).json({ error: 'Could not reach Gemini API', detail: err.message });
  }
};
