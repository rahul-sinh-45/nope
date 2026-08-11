import express from 'express';
import { getAdvancedJobbing, saveAdvancedJobbing } from '../Controllers/advancedJobbingController.js';

const router = express.Router();

router.get('/advanced-jobbing', getAdvancedJobbing);
router.post('/advanced-jobbing/save', saveAdvancedJobbing);

export default router;
