import express from 'express';
import { createTransaction, getTransactions, updateTransactionStatus, getAllBrokerTransactions } from '../Controllers/transactionController.js';

const router = express.Router();

router.post('/create', createTransaction);
router.get('/history', getTransactions);
router.get('/all', getAllBrokerTransactions);
router.put('/updateStatus', updateTransactionStatus);

export default router;
