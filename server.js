import express, { response } from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import mongoose from "mongoose"
import tripRoutes from './routes/tripRoute.js'
import userRoutes from './routes/userRoute.js'

dotenv.config();
const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use('/api/trips',tripRoutes);
app.use('/api/users',userRoutes);

app.get('/', (req, res) => {
    res.send('AI Travel planner backend Running');
})

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MONGO DB IS CONNECTED "))
.catch(err => console.log(err))

const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Server running at PORT ${PORT}`);

})
