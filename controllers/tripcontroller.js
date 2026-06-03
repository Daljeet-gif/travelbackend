import Trip from '../models/Trip.js';
import { resolveLocation } from '../utils/locationResolver.js';
import { getPlace } from '../services/placeService.js';
import { generateItinerary, chatWithAI, generatePackingList, generateLocalInfo } from '../services/aiService.js';
import crypto from 'crypto';
import { getWeather } from '../services/weatherServices.js';
import { estimateTravelBudget } from '../services/budgetService.js';

export const planTrip = async (req, res) => {
    try {
        const { location, budget, days, interests, fromCity } = req.body;
        const userId = req.user?.id;

        if (!location || !days || !budget || !interests) {
            return res.status(400).json({
                error: "location, days, budget, and interests are required"
            });
        }

        const totalDays = parseInt(days);
        const resolved = resolveLocation(location);

        // 📅 City days allocation
        const cityDays = [];
        let remainingDays = totalDays;
        const citiesCount = resolved.cities.length;

        resolved.cities.forEach((city, index) => {
            let allocatedDays;
            if (index === citiesCount - 1) {
                allocatedDays = remainingDays;
            } else {
                allocatedDays = Math.max(1, Math.floor(totalDays / citiesCount));
                remainingDays -= allocatedDays;
            }
            cityDays.push({ city, days: allocatedDays });
        });

        // 📍 Get places first (we need coords for weather)
        const allPlaces = await Promise.all(
            resolved.cities.map(async (city) => {
                const places = await getPlace(city);
                return { city, places };
            })
        );

        // 🌦️ Weather using coords from places (fixes wrong country bug)
        const weatherData = await Promise.all(
            cityDays.map(({ city, days: cityDayCount }) => {
                const cityPlaces = allPlaces.find(p => p.city === city)?.places || [];
                const firstPlace = cityPlaces[0];

                if (firstPlace?.lat && firstPlace?.lon) {
                    // ✅ Use coordinates — no more Mexico bug
                    return getWeather(firstPlace.lat, firstPlace.lon, cityDayCount);
                } else {
                    return getWeather(city, cityDayCount); // fallback
                }
            })
        );

        // 🗺️ Map data
        let globalIndex = 1;
        const allMarkers = allPlaces.flatMap(({ city, places }) =>
            places
                .filter(p => p.lat && p.lon)
                .map((p) => ({ ...p, city, markerIndex: globalIndex++ }))
        );

        const firstMarker = allMarkers[0];
        const staticMapUrl = firstMarker
            ? buildStaticMapUrl(allMarkers, process.env.GEOAPIFY_API_KEY)
            : null;

        const mapData = {
            center: firstMarker
                ? { lat: firstMarker.lat, lon: firstMarker.lon }
                : null,
            markers: allMarkers,
            staticMapUrl
        };

        // 💰 Budget estimate (only if fromCity provided)
        let budgetEstimate = null;
        if (fromCity) {
            try {
                budgetEstimate = await estimateTravelBudget(
                    fromCity,
                    resolved.cities[0], // main destination city
                    totalDays,
                    budget
                );
            } catch (err) {
                console.error("Budget estimate failed:", err.message);
            }
        }

        // 🤖 AI Itinerary
        let itinerary;
        try {
            itinerary = await generateItinerary(
                {
                    location,
                    days: totalDays,
                    budget,
                    interests,
                    resolvedCities: resolved.cities,
                    cityDays
                },
                allPlaces
            );
        } catch (err) {
            console.error("AI Error:", err.message);
            itinerary = "Unable to generate itinerary at the moment.";
        }

        // 💾 Save to DB
        const trip = await Trip.create({
            userId,
            location,
            resolvedCities: resolved.cities,
            cityDays,
            days: totalDays,
            budget,
            interests,
            itinerary,
            weather: weatherData,
            mapData,
            budgetEstimate
        });

        res.json({
            message: resolved.type === 'state'
                ? "State detected, using major cities"
                : "City detected",
            trip
        });

    } catch (error) {
        console.error("Controller Error:", error.message);
        res.status(500).json({
            error: "Something went wrong while planning trip"
        });
    }
};

// 🗺️ Geoapify static map with gold markers
function buildStaticMapUrl(markers, apiKey) {
    const markerParams = markers
        .filter(m => m.lat && m.lon)
        .slice(0, 10) // max 10 markers
        .map((m, i) =>
            `marker:lonlat:${m.lon},${m.lat};color:%23c99b5a;size:medium;text:${i + 1}`
        )
        .join("|");

    const center = `${markers[0].lon},${markers[0].lat}`;

    return `https://maps.geoapify.com/v1/staticmap?style=dark-matter&width=800&height=400&center=lonlat:${center}&zoom=12&${markerParams}&apiKey=${apiKey}`;
}

export const getUserTrips = async (req, res) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const trips = await Trip.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ trips });
    } catch (error) {
        console.error("Error fetching user trips:", error.message);
        res.status(500).json({ error: "Failed to fetch trips" });
    }
};

// ─── Helper: load a trip the current user owns ────────────────────────────────
async function findOwnedTrip(req) {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return { error: { status: 404, message: "Trip not found" } };
    if (String(trip.userId) !== String(req.user?.id))
        return { error: { status: 403, message: "You don't own this trip" } };
    return { trip };
}

// ─── Get a single trip (owner) ────────────────────────────────────────────────
export const getTripById = async (req, res) => {
    try {
        const { trip, error } = await findOwnedTrip(req);
        if (error) return res.status(error.status).json({ error: error.message });
        res.json({ trip });
    } catch (e) {
        console.error("getTripById:", e.message);
        res.status(500).json({ error: "Failed to fetch trip" });
    }
};

// ─── Chat about a trip ────────────────────────────────────────────────────────
export const chatTrip = async (req, res) => {
    try {
        const { trip, error } = await findOwnedTrip(req);
        if (error) return res.status(error.status).json({ error: error.message });

        const { message, history } = req.body;
        if (!message?.trim()) return res.status(400).json({ error: "message is required" });

        const messages = [...(history || []), { role: "user", content: message }];
        const reply = await chatWithAI(trip, messages);

        // Persist a trimmed chat log
        trip.chat.push({ role: "user", content: message });
        trip.chat.push({ role: "assistant", content: reply });
        if (trip.chat.length > 40) trip.chat = trip.chat.slice(-40);
        await trip.save();

        res.json({ reply });
    } catch (e) {
        console.error("chatTrip:", e.message);
        res.status(500).json({ error: "Chat failed" });
    }
};

// ─── Packing list (generate + cache) ──────────────────────────────────────────
export const packingList = async (req, res) => {
    try {
        const { trip, error } = await findOwnedTrip(req);
        if (error) return res.status(error.status).json({ error: error.message });

        if (!req.query.refresh && trip.packingList)
            return res.json({ packingList: trip.packingList });

        const packing = await generatePackingList(trip);
        trip.packingList = packing;
        await trip.save();
        res.json({ packingList: packing });
    } catch (e) {
        console.error("packingList:", e.message);
        res.status(500).json({ error: "Failed to generate packing list" });
    }
};

// ─── Local info (generate + cache) ────────────────────────────────────────────
export const localInfo = async (req, res) => {
    try {
        const { trip, error } = await findOwnedTrip(req);
        if (error) return res.status(error.status).json({ error: error.message });

        if (!req.query.refresh && trip.localInfo)
            return res.json({ localInfo: trip.localInfo });

        const info = await generateLocalInfo(trip);
        trip.localInfo = info;
        await trip.save();
        res.json({ localInfo: info });
    } catch (e) {
        console.error("localInfo:", e.message);
        res.status(500).json({ error: "Failed to generate local info" });
    }
};

// ─── Toggle public sharing ────────────────────────────────────────────────────
export const shareTrip = async (req, res) => {
    try {
        const { trip, error } = await findOwnedTrip(req);
        if (error) return res.status(error.status).json({ error: error.message });

        if (!trip.shareId) trip.shareId = crypto.randomBytes(8).toString("hex");
        trip.isPublic = true;
        await trip.save();
        res.json({ shareId: trip.shareId, isPublic: true });
    } catch (e) {
        console.error("shareTrip:", e.message);
        res.status(500).json({ error: "Failed to share trip" });
    }
};

// ─── Unshare ──────────────────────────────────────────────────────────────────
export const unshareTrip = async (req, res) => {
    try {
        const { trip, error } = await findOwnedTrip(req);
        if (error) return res.status(error.status).json({ error: error.message });
        trip.isPublic = false;
        await trip.save();
        res.json({ isPublic: false });
    } catch (e) {
        console.error("unshareTrip:", e.message);
        res.status(500).json({ error: "Failed to unshare trip" });
    }
};

// ─── Public: view a shared trip (no auth) ─────────────────────────────────────
export const getSharedTrip = async (req, res) => {
    try {
        const trip = await Trip.findOne({ shareId: req.params.shareId, isPublic: true })
            .select("-userId -chat");
        if (!trip) return res.status(404).json({ error: "Shared trip not found" });
        res.json({ trip });
    } catch (e) {
        console.error("getSharedTrip:", e.message);
        res.status(500).json({ error: "Failed to fetch shared trip" });
    }
};

// ─── Delete a trip (owner) ────────────────────────────────────────────────────
export const deleteTrip = async (req, res) => {
    try {
        const { trip, error } = await findOwnedTrip(req);
        if (error) return res.status(error.status).json({ error: error.message });
        await trip.deleteOne();
        res.json({ message: "Trip deleted" });
    } catch (e) {
        console.error("deleteTrip:", e.message);
        res.status(500).json({ error: "Failed to delete trip" });
    }
};