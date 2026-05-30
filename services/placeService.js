import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY;

export async function getPlace(location) {
    try {
        // Step 1: Get coordinates

        
        const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(location)}&apiKey=${GEOAPIFY_KEY}`;

        const geoRes = await axios.get(geoUrl);

        const features = geoRes.data.features;

     
        
        if (!features.length) {
            throw new Error("Location not found");
        }

        const selectedPlace =
            features.find(f => f.properties.country_code === 'in') ||
            features[0];

        const { lat, lon } = selectedPlace.properties;
   

        // Step 2: Get tourist places
        const placesUrl = `https://api.geoapify.com/v2/places?categories=tourism.sights&filter=circle:${lon},${lat},5000&limit=5&apiKey=${GEOAPIFY_KEY}`;

        const placesRes = await axios.get(placesUrl);

       
        
        return placesRes.data.features.map(p => ({
    name: p.properties.name,
    address: p.properties.formatted,
    category: p.properties.categories,
        lat: p.properties.lat,      // ← add these
    lon: p.properties.lon,
})).filter(p => p.name);

    } catch (error) {
        console.error("Geo API Error:", error.response?.data || error.message);
        throw new Error("Failed to fetch places");
    }
}