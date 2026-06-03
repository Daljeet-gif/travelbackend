import mongoose from "mongoose";

const TripSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
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
        tier: String,
        route: { distanceKm: String, durationHrs: String },
        transport: { type: mongoose.Schema.Types.Mixed },
        perDay: { type: mongoose.Schema.Types.Mixed },
        totalEstimate: { min: String, max: String },
        days: Number,
    },

    // AI-generated extras (lazily filled on demand)
    packingList: { type: mongoose.Schema.Types.Mixed, default: null },
    localInfo: { type: mongoose.Schema.Types.Mixed, default: null },
    chat: [
        {
            role: { type: String, enum: ["user", "assistant"] },
            content: String,
            at: { type: Date, default: Date.now },
        },
    ],

    // Public sharing
    isPublic: { type: Boolean, default: false },
    shareId: { type: String, index: true, sparse: true, unique: true },

}, { timestamps: true });

const Trip = mongoose.model('Trip', TripSchema);
export default Trip;