import Trip from '../models/Trip.js';
import { resolveLocation } from '../utils/locationResolver.js';
import { getPlace } from '../services/placeService.js';
import { generateItinerary } from '../services/aiService.js';
import { getWeather } from '../services/weatherServices.js';

export const planTrip = async (req, res) => {
    try {
        const { location, budget, days, interests, fromCity } = req.body;

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