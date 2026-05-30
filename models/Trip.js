import mongoose from "mongoose";

const TripSchema = new mongoose.Schema({
    location: String,
    resolvedCities: [String],
    cityDays: [{ city: String, days: Number }],
    budget: String,
    days: Number,
    interests: [String],
    itinerary: String,

    weather: [
        {
            city: String,
            current: {
                temp: Number,
                condition: String,
                icon: String,
            },
            forecast: [
                {
                    date: String,
                    maxTemp: Number,
                    minTemp: Number,
                    condition: String,
                    icon: String,
                }
            ],
            error: String,
        }
    ],

    mapData: {
        center: { lat: Number, lon: Number },
        staticMapUrl: String,
        markers: [
            {
                name: String,
                address: String,
                lat: Number,
                lon: Number,
                city: String,
                markerIndex: Number,
            }
        ],
    },

    budgetEstimate: {
        route: { distanceKm: String, durationHrs: String },
        transport: { type: mongoose.Schema.Types.Mixed },
        perDay: { type: mongoose.Schema.Types.Mixed },
        totalEstimate: { min: String, max: String },
        days: Number,
    }

}, { timestamps: true });

const Trip = mongoose.model('Trip', TripSchema);
export default Trip;