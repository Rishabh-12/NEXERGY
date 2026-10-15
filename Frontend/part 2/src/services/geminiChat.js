const MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function sendGeminiChat({ apiKey, history, context }) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: [
          "You are NexEnergy, a concise, practical assistant for a campus energy optimizer.",
          "Use the supplied room telemetry as your only source for current values. Distinguish live occupancy from estimated energy and simulated savings.",
          "Never claim the camera measures electricity. Explain assumptions, give actionable advice, and keep answers to 2-5 short sentences.",
          `Current app telemetry (JSON): ${JSON.stringify(context)}`,
        ].join("\n\n") }],
      },
      contents: history.slice(-12).map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.text }],
      })),
      generationConfig: { temperature: 0.45, maxOutputTokens: 360 },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini request failed (${response.status}).`);
  }
  const answer = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("\n")
    .trim();
  if (!answer) throw new Error("Gemini returned an empty response.");
  return answer;
}
