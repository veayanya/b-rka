// b-rka/utils/geminiHelper.js
// Shared helper for calling the Gemini API with automatic model fallback.
// Used by server.js (RKA evaluation, SSH text extraction) and parseSshPdf.js
// (SSH PDF upload analysis) so the fallback logic lives in one place.

/**
 * Try a list of candidate Gemini models in order; if all fail, fetch the
 * list of models actually available for this API key and try those too.
 *
 * @param {import('@google/generative-ai').GoogleGenerativeAI} genAIInstance
 * @param {string} clientApiKey
 * @param {string} prompt
 */
export async function generateContentWithFallback(genAIInstance, clientApiKey, prompt) {
  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
    'gemini-1.5-pro'
  ];
  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAIInstance.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result;
    } catch (err) {
      console.warn(`Model ${modelName} gagal: ${err.message}`);
      lastError = err;
      if (err.status === 403 || err.message?.includes('403 Forbidden') || err.message?.includes('API key not valid')) {
        throw new Error('API Key Gemini tidak valid atau tidak memiliki akses.');
      }
    }
  }

  // Dynamic fallback: fetch list of available models for this key from Google API
  try {
    const fetchResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${clientApiKey}`);
    const data = await fetchResp.json();
    if (data && data.models && data.models.length > 0) {
      const available = data.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'));
      for (const m of available) {
        const name = m.name.replace('models/', '');
        if (!candidateModels.includes(name)) {
          try {
            const model = genAIInstance.getGenerativeModel({ model: name });
            return await model.generateContent(prompt);
          } catch (e) {}
        }
      }
    }
    if (data && data.error && data.error.message) {
      throw new Error(data.error.message);
    }
  } catch (dynErr) {
    console.error("Dynamic model fetch error:", dynErr);
  }

  throw lastError || new Error("Tidak ada model Gemini yang dapat digunakan dengan API Key ini.");
}

/**
 * Clean a raw Gemini text response and parse it as JSON.
 *
 * @param {string} rawText
 * @returns {any} parsed JSON
 */
export function parseAiJson(rawText) {
  // First, strip markdown fences if they surround the whole text
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  // Then, locate the outermost JSON structure `{ ... }`
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  // Strip potential hidden control characters or invalid whitespace inside the JSON string
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('parseAiJson: gagal parse JSON. Teks mentah dari AI:\n', rawText);
    const snippet = rawText.length > 200 ? rawText.slice(0, 200) + '...' : rawText;
    throw new Error(`AI mengembalikan format yang tidak bisa dibaca sebagai JSON (${err.message}). Cuplikan respons: "${snippet}"`);
  }
}
