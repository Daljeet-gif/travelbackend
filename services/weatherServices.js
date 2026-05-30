import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
const WEATHER_KEY = process.env.WEATHER_API_KEY;
export async function getWeather(lat, lon, days) {
    try {
        const url = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHER_KEY}&q=${lat},${lon}&days=${days}`;
        const res = await axios.get(url);
        // remove the console.log(res) — it's flooding your logs
        return {
            city: res.data.location.name,
            current: {
                temp: res.data.current.temp_c,
                condition: res.data.current.condition.text,
                icon: res.data.current.condition.icon,
            },
            forecast: res.data.forecast.forecastday.map(day => ({
                date: day.date,
                maxTemp: day.day.maxtemp_c,
                minTemp: day.day.mintemp_c,
                condition: day.day.condition.text,
                icon: day.day.condition.icon
            }))
        };
    } catch (error) {
        console.error("Weather Error:", error.message);
        return { error: "Weather not available" };
    }
}