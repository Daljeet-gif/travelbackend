import express from 'express';
import {
    planTrip,
    getUserTrips,
    getTripById,
    chatTrip,
    packingList,
    localInfo,
    shareTrip,
    unshareTrip,
    getSharedTrip,
    deleteTrip,
} from '../controllers/tripcontroller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/share/:shareId', getSharedTrip);

// Protected
router.post('/plan', authenticate, planTrip);
router.get('/my-trips', authenticate, getUserTrips);
router.get('/:id', authenticate, getTripById);
router.delete('/:id', authenticate, deleteTrip);
router.post('/:id/chat', authenticate, chatTrip);
router.get('/:id/packing', authenticate, packingList);
router.get('/:id/local-info', authenticate, localInfo);
router.post('/:id/share', authenticate, shareTrip);
router.post('/:id/unshare', authenticate, unshareTrip);

export default router;
