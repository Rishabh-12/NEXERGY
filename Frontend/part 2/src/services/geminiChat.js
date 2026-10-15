const MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 30_000;

const SYSTEM_INSTRUCTIONS = [
  "You are NexEnergy, the project-specific energy assistant inside the Smart Campus Energy Optimizer.",
  "The product helps campus teams identify potential waste, estimate energy use, compare what-if scenarios, and understand possible savings. The digital twin models Building A with three floors and nine rooms.",
  "The computer-vision pipeline uses detect.py for person-only occupancy detection. It does not detect cell phones and must never be described as measuring electricity, energy consumption, or equipment power.",
  "Use the current app telemetry JSON and recent chat messages as the source of truth. Answer the user's actual question directly. Explain which values are backend occupancy, sample estimates, equipment assumptions, or applied simulation results. Never invent meter readings, weather data, occupancy, savings, or actions that the system did not report.",
  "Energy figures use illustrative equipment ratings and are estimates. Do not claim the assistant remotely controls building equipment; the UI changes the model/scenario only. For unconnected rooms, say occupancy and energy are sample estimates and do not apply A-101 simulation results to them.",
  "Give practical, campus-safe suggestions. Keep replies to 2–5 short sentences, include the relevant room/value when useful, and state uncertainty plainly. If asked for something outside the available project data, say what is missing and suggest how to obtain it.",
].join("\n\n");

function toGeminiHistory(history) {
  const valid = history
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.text?.trim())
    .slice(-12);
  const firstUserIndex = valid.findIndex((message) => message.role === "user");
  if (firstUserIndex < 0) return [];

  const ordered = valid.slice(firstUserIndex);
  const turns = [];
  for (const message of ordered) {
    const role = message.role === "assistant" ? "model" : "user";
    const previous = turns.at(-1);
    if (previous?.role === role) previous.parts[0].text += `\n\n${message.text.trim()}`;
    else turns.push({ role, parts: [{ text: message.text.trim() }] });
  }
  while (turns[0]?.role === "model") turns.shift();
  return turns;
}

export async function sendGeminiChat({ apiKey, history, context }) {
  const contents = toGeminiHistory(history);
  if (!contents.length) throw new Error("Add a message before sending it to Gemini.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM_INSTRUCTIONS}\n\nCURRENT APP TELEMETRY (JSON):\n${JSON.stringify(context)}` }],
        },
        contents,
        generationConfig: { temperature: 0.45, maxOutputTokens: 420 },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("The Gemini request timed out after 30 seconds.");
    throw new Error("Could not reach Gemini. Check your internet connection and browser network access.");
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini request failed (${response.status}).`;
    if (response.status === 400 || response.status === 403) throw new Error(`Gemini rejected the key or request: ${message}`);
    if (response.status === 429) throw new Error(`Gemini quota or rate limit reached: ${message}`);
    throw new Error(message);
  }
  const candidate = payload?.candidates?.[0];
  const answer = candidate?.content?.parts?.map((part) => part.text || "").join("\n").trim();
  if (!answer) {
    if (candidate?.finishReason === "SAFETY") throw new Error("Gemini did not answer because its safety filters blocked the request.");
    throw new Error("Gemini returned an empty response. Try rephrasing your question.");
  }
  return answer;
}
