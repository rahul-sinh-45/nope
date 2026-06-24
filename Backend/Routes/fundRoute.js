import express from 'express';
import { updateNetAvailableBalance, updateNetPnl, getFunds, updateIntradayAvailabeLimit , updateOvernightAvailableLimit, updateIntradayLimitsAll, updateOvernightLimitsAll, updateOptionLimitsAll, updateMcxLimitsAll, updateBrokerMobile, updateOptionLimitPercentage, updateMcxLimitPercentage, getCustomerJobbing, updateCustomerJobbing, updatePaymentDetails, updateWithdrawalLimits, getWithdrawalLimits} from '../Controllers/fundController.js';

const router = express.Router();

router.put('/updateNetAvailableBalance', updateNetAvailableBalance);
router.put('/updateNetPnl', updateNetPnl);
router.put('/updatePaymentDetails', updatePaymentDetails);
router.get('/getFunds', getFunds);
router.put('/updateIntradayAvailableLimit', updateIntradayAvailabeLimit);
router.put('/updateOvernightAvailableLimit', updateOvernightAvailableLimit);
router.put('/updateIntradayLimitsAll', updateIntradayLimitsAll);
router.put('/updateOvernightLimitsAll', updateOvernightLimitsAll);
router.put('/updateOptionLimitsAll', updateOptionLimitsAll);
router.put('/updateMcxLimitsAll', updateMcxLimitsAll);
router.put('/updateBrokerMobile', updateBrokerMobile);
router.put('/updateOptionLimitPercentage', updateOptionLimitPercentage);
router.put('/updateMcxLimitPercentage', updateMcxLimitPercentage);

// Per-customer jobbing settings
router.get('/getCustomerJobbing', getCustomerJobbing);
router.put('/updateCustomerJobbing', updateCustomerJobbing);

// Withdrawal limits (broker sets per customer)
router.get('/getWithdrawalLimits', getWithdrawalLimits);
router.put('/updateWithdrawalLimits', updateWithdrawalLimits);

export default router;