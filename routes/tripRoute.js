import express from 'express';
import {planTrip} from '../controllers/tripcontroller.js';
const router =express.Router();

router.post('/plan',planTrip);

export default router

