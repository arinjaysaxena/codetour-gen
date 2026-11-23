// Minimal OpenAI-compatible chat-completions client. `fetchImpl` is injectable for tests.
export function createLlm(config, fetchImpl = globalThis.fetch) {
  return {
    async chat(messages, { temperature = 0.3, signal } = {}) {
      const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, messages, temperature }),
        signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('LLM response had no message content');
      return text.trim();
    },
  };
}
