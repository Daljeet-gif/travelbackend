import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateItinerary(data, places) {
    // const prompt = `
    // You are a professional travel planner.
    // Create a ${data.days}-day itinerary.

    // Location: ${data.location}
    // Cities: ${(data.resolvedCities || []).join(', ')}
    // Budget: ${data.budget}
    // Interests: ${(data.interests || []).join(', ')}

    // Available places:
    // ${JSON.stringify(places)}

    // Rules:
    // - Use given places only
    // - Keep realistic travel flow
    // - Avoid repetition

    // Format:
    // Day 1:
    // Morning:
    // Afternoon:
    // Evening:

    // Day 2:
    // ...
    // `;

    const prompt = `
You are an expert travel planner with deep knowledge of local culture, logistics, and traveler preferences.

Your task is to create a detailed, realistic, and engaging ${data.days}-day travel itinerary.

===TRIP DETAILS===
- Destination: ${data.location}
- Cities to cover: ${(data.resolvedCities || []).join(', ')}
- Total Duration: ${data.days} days
- Budget Level: ${data.budget} (tailor activity choices, dining, and transport accordingly)
- Traveler Interests: ${(data.interests || []).join(', ')}

===AVAILABLE PLACES (USE ONLY THESE)===
${JSON.stringify(places, null, 2)}

===PLANNING RULES===
1. Only use places from the list above — do not invent or suggest unlisted locations.
2. Group nearby places together to minimize travel time and maximize experience.
3. Assign places logically: museums/indoor spots for afternoons, iconic landmarks for mornings.
4. Match activity intensity and cost to the "${data.budget}" budget level.
5. Avoid repeating the same place or type of activity across days.
6. Ensure a natural flow — account for opening hours, fatigue, and travel between stops.
7. Align suggestions with the traveler's interests: ${(data.interests || []).join(', ')}.

===OUTPUT FORMAT (STRICTLY FOLLOW THIS)===
For each time slot, provide:
- 📍 Place name
- ⏱ Suggested duration
- 💡 A 1-line tip or reason why it fits this traveler

Day 1: [Optional catchy day theme, e.g. "Arrival & First Impressions"]
🌅 Morning:
  - [Place] — [Duration] — [Tip]

☀️ Afternoon:
  - [Place] — [Duration] — [Tip]

🌙 Evening:
  - [Place] — [Duration] — [Tip]

Day 2: [Theme]
...and so on for all ${data.days} days.

End with a short 2-line "Pro Travel Tip" relevant to ${data.location}.
`;

    try {
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",   // free, high quality
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1024,
            temperature: 0.7
        });

        return response.choices[0]?.message?.content || "No itinerary generated";

    } catch (error) {
        console.error("Groq ERROR:", error.message);
        throw new Error("AI generation failed");
    }
}

const MODEL = "llama-3.3-70b-versatile";

// Build a compact textual summary of a trip for AI context.
function tripContext(trip) {
    return [
        `Destination: ${trip.location}`,
        `Cities: ${(trip.resolvedCities || []).join(", ")}`,
        `Duration: ${trip.days} days`,
        `Budget: ${trip.budget}`,
        `Interests: ${(trip.interests || []).join(", ")}`,
        trip.itinerary ? `\nCurrent itinerary:\n${trip.itinerary}` : "",
    ].join("\n");
}

// Safely parse a JSON object out of an LLM response.
function safeJson(text, fallback = {}) {
    if (!text) return fallback;
    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { /* ignore */ }
        }
        return fallback;
    }
}

// ─── Conversational trip assistant ────────────────────────────────────────────
export async function chatWithAI(trip, messages = []) {
    const systemPrompt = `You are TripGenie, a friendly and knowledgeable AI travel assistant.
You are helping the user with THIS specific trip. Use the trip details below to give concrete,
personalised answers (restaurant ideas, day tweaks, local tips, timing, transport, etc.).
Keep replies concise, warm and practical. Use short paragraphs or bullet points.

===TRIP CONTEXT===
${tripContext(trip)}`;

    try {
        const response = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                ...messages.slice(-12).map((m) => ({
                    role: m.role === "assistant" ? "assistant" : "user",
                    content: String(m.content || "").slice(0, 2000),
                })),
            ],
            max_tokens: 800,
            temperature: 0.7,
        });
        return response.choices[0]?.message?.content || "Sorry, I couldn't respond just now.";
    } catch (error) {
        console.error("Chat ERROR:", error.message);
        throw new Error("AI chat failed");
    }
}

// ─── Packing list generator ───────────────────────────────────────────────────
export async function generatePackingList(trip) {
    const weatherSummary = (trip.weather || [])
        .map((w) => `${w.city}: ${w.current?.condition || "n/a"}, ${w.current?.temp ?? "?"}°C`)
        .join("; ");

    const prompt = `Create a smart packing list for this trip. Respond with ONLY valid JSON.

Trip: ${trip.location}, ${trip.days} days.
Interests: ${(trip.interests || []).join(", ")}.
Weather: ${weatherSummary || "unknown"}.
Budget level: ${trip.budget}.

JSON shape:
{
  "categories": [
    { "name": "Essentials", "items": ["Passport", "Phone charger"] },
    { "name": "Clothing", "items": [] },
    { "name": "Toiletries", "items": [] },
    { "name": "Electronics", "items": [] },
    { "name": "Activity Gear", "items": [] }
  ],
  "notes": ["1-2 short weather/activity-specific packing tips"]
}
Tailor items to the weather and interests. 4-7 items per category.`;

    try {
        const response = await groq.chat.completions.create({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 800,
            temperature: 0.5,
            response_format: { type: "json_object" },
        });
        return safeJson(response.choices[0]?.message?.content, { categories: [], notes: [] });
    } catch (error) {
        console.error("Packing ERROR:", error.message);
        throw new Error("Packing list generation failed");
    }
}

// ─── Local / destination info ─────────────────────────────────────────────────
export async function generateLocalInfo(trip) {
    const prompt = `Provide practical destination info for a traveller visiting ${trip.location}
(cities: ${(trip.resolvedCities || []).join(", ")}). Respond with ONLY valid JSON.

JSON shape:
{
  "currency": { "name": "", "code": "", "tipping": "short tipping norm" },
  "language": { "primary": "", "phrases": [ { "en": "Hello", "local": "" }, { "en": "Thank you", "local": "" }, { "en": "How much?", "local": "" } ] },
  "emergency": { "police": "", "ambulance": "", "general": "" },
  "visa": "1-line visa note for a typical international tourist",
  "bestTimeToVisit": "",
  "tips": ["3-4 short culture/safety/etiquette tips"]
}`;

    try {
        const response = await groq.chat.completions.create({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 800,
            temperature: 0.4,
            response_format: { type: "json_object" },
        });
        return safeJson(response.choices[0]?.message?.content, {});
    } catch (error) {
        console.error("Local info ERROR:", error.message);
        throw new Error("Local info generation failed");
    }
}