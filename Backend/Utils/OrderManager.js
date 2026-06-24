import Order from '../Model/OrdersModel.js';
import Fund from '../Model/FundModel.js';

// =========================================================
// 1. GLOBAL MEMORY (RAM) - THE WATCHLIST
// Key   = Instrument Token (String)
// Value = Map of OrderId -> TriggerData
// =========================================================
export const activeTriggers = new Map();

/**
 * =========================================================
 * 2. INITIALIZATION (SERVER STARTUP)
 * Server restart hone par DB se wo saare orders load karo jo CLOSED nahi hain.
 * Covers: 'OPEN', 'HOLD', and null (Overnight)
 * =========================================================
 */
export const loadOpenOrders = async () => {
    try {
        console.log("🔄 [OrderManager] Loading active triggers...");

        // LOGIC: Status 'CLOSED' nahi hona chahiye + SL ya Target set hona chahiye
        const activeOrders = await Order.find({
            order_status: { $ne: 'CLOSED' }, // Means: OPEN, HOLD, or null
            $or: [
                { stop_loss: { $exists: true, $ne: null, $gt: 0 } },
                { target: { $exists: true, $ne: null, $gt: 0 } }
            ]
        });

        activeTriggers.clear();

        activeOrders.forEach(order => {
            addToWatchlist(order);
        });

        console.log(`✅ [OrderManager] System Ready. Tracking ${activeOrders.length} active orders.`);
    } catch (error) {
        console.error("❌ [OrderManager] Failed to load orders:", error);
    }
};

/**
 * =========================================================
 * 3. ADD ORDER TO MEMORY
 * Helper function to push order into RAM
 * =========================================================
 */
export const addToWatchlist = (order) => {
    // 1. Agar Order CLOSED hai to ignore karo
    if (order.order_status === 'CLOSED') return;

    // Use instrument_token for Kite (fallback to security_Id for backward compatibility)
    const token = String(order.instrument_token || order.security_Id);
    const sl = Number(order.stop_loss) || 0;
    const target = Number(order.target) || 0;

    // 2. Agar SL aur Target dono 0 hain, to track karne ka fayda nahi
    if (sl === 0 && target === 0) return;

    if (!activeTriggers.has(token)) {
        activeTriggers.set(token, new Map());
    }

    // 3. Store only necessary data
    const triggerData = {
        orderId: String(order._id),
        side: order.side,          // 'BUY' or 'SELL'
        sl: sl,
        target: target,
        increase_price: Number(order.increase_price) || 0,
        jobbin_type: order.jobbin_type || 'percentage',
        jobbing_point: Number(order.jobbing_point) || 0,
        status: order.order_status,
        broker_id_str: order.broker_id_str,
        customer_id_str: order.customer_id_str,
        product: order.product,
        margin_blocked: order.margin_blocked,
        price: order.price,
        quantity: order.quantity
    };

    activeTriggers.get(token).set(triggerData.orderId, triggerData);
    // console.log(`➕ Monitoring: ${order.symbol} | SL: ${sl} | TGT: ${target}`);
};

/**
 * =========================================================
 * 4. UPDATE ORDER IN MEMORY
 * Jab user Modify kare (SL change kare) ya Status change ho
 * =========================================================
 */
export const updateTriggerInWatchlist = (order) => {
    // Use instrument_token for Kite (fallback to security_Id for backward compatibility)
    const token = String(order.instrument_token || order.security_Id);
    const orderIdStr = String(order._id);

    // Step 1: Purana entry hatao (taaki duplicate na ho)
    if (activeTriggers.has(token)) {
        const ordersMap = activeTriggers.get(token);
        ordersMap.delete(orderIdStr);

        if (ordersMap.size === 0) {
            activeTriggers.delete(token);
        }
    }

    // Step 2: Agar abhi bhi CLOSED nahi hai, to wapas add karo
    if (order.order_status !== 'CLOSED') {
        addToWatchlist(order);
    }
};

/**
 * =========================================================
 * 5. EXECUTE EXIT (DB UPDATE ONLY)
 * Jab SL ya Target Hit ho jaye
 * =========================================================
 */
const executeExit = async (orderData, exitPrice, reason) => {
    const { orderId, token } = orderData;

    console.log(`⚡ [OrderManager] Trigger Hit! Order: ${orderId}, Reason: ${reason}, Price: ${exitPrice}`);

    try {
        // A. Remove from Memory IMMEDIATELY (Prevent Double Execution)
        if (activeTriggers.has(token)) {
            const ordersMap = activeTriggers.get(token);
            ordersMap.delete(orderId);
            if (ordersMap.size === 0) {
                activeTriggers.delete(token);
            }
        }

        // B. Update Order Status in Database
        let finalExitPrice = Number(exitPrice);

        // Apply Manual Jobbing Point (₹ flat amount)
        const jpValue = Number(orderData.jobbing_point) || 0;
        if (jpValue > 0 && finalExitPrice > 0) {
            finalExitPrice = orderData.side === 'BUY' ? finalExitPrice - jpValue : finalExitPrice + jpValue;
        }
        const closedLtp = finalExitPrice > 0 ? Number(finalExitPrice.toFixed(4)) : 0;

        await Order.findByIdAndUpdate(orderId, {
            $set: {
                order_status: "CLOSED",
                closed_ltp: closedLtp,
                closed_at: new Date(),
                margin_blocked: 0,
                exit_reason: reason
            }
        });

        // C. ⚡ Release Fund Atomically
        const { broker_id_str, customer_id_str, product, margin_blocked, price, quantity, side } = orderData;
        const marginToRelease = Number(margin_blocked || (price * quantity) || 0);
        
        let pnl = 0;
        if (closedLtp > 0) {
            pnl = side === 'BUY' ? (closedLtp - price) * quantity : (price - closedLtp) * quantity;
        }

        if (marginToRelease > 0 || pnl !== 0) {
            const isIntraday = String(product).trim().toUpperCase() === 'MIS';
            const incQuery = {};
            if (marginToRelease > 0) {
                if (isIntraday) incQuery["intraday.used_limit"] = -marginToRelease;
                else incQuery["overnight.available_limit"] = marginToRelease;
            }
            if (pnl !== 0) incQuery["net_pnl"] = pnl;

            await Fund.updateOne(
                { broker_id_str, customer_id_str },
                { $inc: incQuery }
            );
        }

        console.log(`✅ [OrderManager] Order ${orderId} Closed Successfully.`);

    } catch (error) {
        console.error(`❌ [OrderManager] Execution Error for Order ${orderId}:`, error);
    }
};

export const onMarketTick = async ({ token, ltp }) => {
    // 1. Check if we are watching this token
    if (!activeTriggers.has(String(token))) return;

    const ordersMap = activeTriggers.get(String(token));
    const currentLtp = Number(ltp);

    if (!currentLtp || currentLtp <= 0) return;

    const exitPromises = [];

    // 2. Iterate through orders Map
    for (const order of ordersMap.values()) {
        let hit = false;
        let hitReason = "";
        let hitPrice = 0;

        if (order.side === 'BUY') {
            if (order.sl > 0 && currentLtp <= order.sl) {
                hit = true; hitReason = "STOPLOSS_HIT"; hitPrice = order.sl;
            } else if (order.target > 0 && currentLtp >= order.target) {
                hit = true; hitReason = "TARGET_HIT"; hitPrice = order.target;
            }
        } else {
            if (order.sl > 0 && currentLtp >= order.sl) {
                hit = true; hitReason = "STOPLOSS_HIT"; hitPrice = order.sl;
            } else if (order.target > 0 && currentLtp <= order.target) {
                hit = true; hitReason = "TARGET_HIT"; hitPrice = order.target;
            }
        }

        // 3. Queue Execution
        if (hit) {
            exitPromises.push(executeExit({ ...order, token: String(token) }, hitPrice, hitReason));
        }
    }

    if (exitPromises.length > 0) {
        await Promise.allSettled(exitPromises);
    }
};