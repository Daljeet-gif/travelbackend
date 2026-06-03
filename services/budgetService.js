import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY;

const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

// Detect a rough budget tier from a free-text budget string.
function detectTier(budget = "") {
  const b = String(budget).toLowerCase();
  if (/lux|premium|5.?star|expensive/.test(b)) return "luxury";
  if (/back ?pack|cheap|budget|hostel|shoestring/.test(b)) return "budget";

  // Numeric per-day hint
  const num = parseInt(b.replace(/[^0-9]/g, ""), 10);
  if (!Number.isNaN(num)) {
    if (num >= 8000) return "luxury";
    if (num <= 1500) return "budget";
  }
  return "mid";
}

// Per-day cost ranges (INR) by tier.
const PER_DAY = {
  budget: { stay: [600, 1200], food: [300, 600], activities: [200, 500], localTransport: [150, 350] },
  mid: { stay: [1800, 3500], food: [700, 1400], activities: [500, 1200], localTransport: [300, 700] },
  luxury: { stay: [5000, 12000], food: [1500, 3500], activities: [1500, 4000], localTransport: [800, 2000] },
};

async function geocode(place) {
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
    place
  )}&limit=1&apiKey=${GEOAPIFY_KEY}`;
  const { data } = await axios.get(url);
  const f = data.features?.[0];
  if (!f) throw new Error(`Could not geocode "${place}"`);
  return { lat: f.properties.lat, lon: f.properties.lon };
}

/**
 * Estimate travel budget between two cities for a trip.
 * Uses Geoapify routing for distance/time, then heuristics for cost.
 */
export async function estimateTravelBudget(fromCity, toCity, days, budget) {
  const tier = detectTier(budget);

  // 1. Route distance + duration (driving)
  let distanceKm = null;
  let durationHrs = null;
  try {
    const from = await geocode(fromCity);
    const to = await geocode(toCity);
    const routeUrl = `https://api.geoapify.com/v1/routing?waypoints=${from.lat},${from.lon}|${to.lat},${to.lon}&mode=drive&apiKey=${GEOAPIFY_KEY}`;
    const { data } = await axios.get(routeUrl);
    const props = data.features?.[0]?.properties;
    if (props) {
      distanceKm = Math.round(props.distance / 1000);
      durationHrs = Math.round((props.time / 3600) * 10) / 10;
    }
  } catch (err) {
    console.error("Routing failed:", err.message);
  }

  // 2. Transport options (round trip) based on distance
  const transport = {};
  if (distanceKm) {
    const d = distanceKm * 2; // round trip
    transport.cab = `${inr(d * 11)} – ${inr(d * 15)}`;
    transport.selfDrive = `${inr(d * 6)} – ${inr(d * 9)}`;
    transport.bus = `${inr(d * 1.2)} – ${inr(d * 2.2)}`;
    transport.train = `${inr(d * 0.8)} – ${inr(d * 1.6)}`;
    if (distanceKm > 350) {
      const base = 2500 + distanceKm * 3.5;
      transport.flight = `${inr(base * 1.6)} – ${inr(base * 3)}`; // round trip
    }
  }

  // 3. Per-day on-ground costs
  const ranges = PER_DAY[tier];
  const perDay = {
    stay: `${inr(ranges.stay[0])} – ${inr(ranges.stay[1])}`,
    food: `${inr(ranges.food[0])} – ${inr(ranges.food[1])}`,
    activities: `${inr(ranges.activities[0])} – ${inr(ranges.activities[1])}`,
    localTransport: `${inr(ranges.localTransport[0])} – ${inr(ranges.localTransport[1])}`,
  };

  // 4. Total estimate (on-ground × days + cheapest/typical transport)
  const dailyMin = ranges.stay[0] + ranges.food[0] + ranges.activities[0] + ranges.localTransport[0];
  const dailyMax = ranges.stay[1] + ranges.food[1] + ranges.activities[1] + ranges.localTransport[1];

  let transportMin = 0;
  let transportMax = 0;
  if (distanceKm) {
    const d = distanceKm * 2;
    transportMin = d * 0.8; // cheapest: train
    transportMax = distanceKm > 350 ? (2500 + distanceKm * 3.5) * 3 : d * 15;
  }

  const totalEstimate = {
    min: inr(dailyMin * days + transportMin),
    max: inr(dailyMax * days + transportMax),
  };

  return {
    tier,
    route: distanceKm ? { distanceKm: String(distanceKm), durationHrs: String(durationHrs) } : null,
    transport,
    perDay,
    totalEstimate,
    days,
  };
}
