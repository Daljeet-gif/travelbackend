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