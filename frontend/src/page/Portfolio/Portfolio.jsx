import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Zap, Filter, PieChart, X, FileText
} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { calculateExitBrokerageAndPnL } from "../../Utils/calculateBrokerage.jsx";

// --- Helpers ---
const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;
// Chip background for gain/loss indication
const chipBg = (n) => Number(n) > 0 ? "bg-[var(--gain-chip-bg)]" : Number(n) < 0 ? "bg-[var(--loss-chip-bg)]" : "bg-transparent";
// Text color for % and P&L (green/red)
const pnlTextColor = (n) => Number(n) > 0 ? "text-[var(--gain-text)]" : Number(n) < 0 ? "text-[var(--loss-text)]" : "text-[var(--text-primary)]";
const signSym = (n) => (Number(n) > 0 ? "+" : "");
const arrow = (n) => (Number(n) > 0 ? "▲" : Number(n) < 0 ? "▼" : "");

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const getOrderValues = (order) => {
  const qty = parseFloat(order.quantity) || 0;
  let entryPrice = parseFloat(order.average_price);
  if (!entryPrice) entryPrice = parseFloat(order.price) || 0;
  let exitPrice = parseFloat(order.closed_ltp);
  if (!exitPrice) exitPrice = parseFloat(order.ltp) || 0;
  return { qty, entryPrice, exitPrice };
};

// ==========================================
// 1. CLOSED ORDER FILTER COMPONENT
// ==========================================
const RANGE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "day", label: "Day(s)" },
  { value: "month", label: "Month(s)" },
  { value: "year", label: "Year(s)" },
  { value: "expiry", label: "Expired Symbol" },
];

function ClosedOrderFilter({ closedOrders = [], onFilter }) {
  const [range, setRange] = useState("all");
  const [nValue, setNValue] = useState(1);
  const [selectedExpiredSymbol, setSelectedExpiredSymbol] = useState("");

  // compute expired symbols
  const expiredSymbols = useMemo(() => {
    const now = new Date();
    const setSym = new Set();
    for (const o of closedOrders) {
      const expRaw = o?.meta?.selectedStock?.expiry || o?.expireDate;
      const tradingSymbol = o?.meta?.selectedStock?.tradingSymbol ?? o?.symbol ?? "";
      if (!expRaw || !tradingSymbol) continue;
      const exp = new Date(expRaw);
      if (exp <= endOfDay(now)) {
        setSym.add(tradingSymbol);
      }
    }
    return Array.from(setSym).sort();
  }, [closedOrders]);

  const computeFiltered = () => {
    const now = new Date();
    const end = endOfDay(now);

    if (range === "all") return closedOrders.slice();

    if (range === "expiry") {
      const list = closedOrders.filter((o) => {
        const expRaw = o?.meta?.selectedStock?.expiry || o?.expireDate;
        if (!expRaw) return false;
        return new Date(expRaw) <= end;
      });
      if (!selectedExpiredSymbol) return list;
      return list.filter((o) => {
        const tradingSymbol = o?.meta?.selectedStock?.tradingSymbol ?? o?.symbol ?? "";
        return String(tradingSymbol) === String(selectedExpiredSymbol);
      });
    }

    let start = null;
    if (range === "today") start = startOfDay(now);
    else if (range === "day") {
      const s = new Date(now); s.setDate(s.getDate() - Math.max(1, Number(nValue) || 1));
      start = startOfDay(s);
    } else if (range === "month") {
      const s = new Date(now); s.setMonth(s.getMonth() - Math.max(1, Number(nValue) || 1));
      start = startOfDay(s);
    } else if (range === "year") {
      const s = new Date(now); s.setFullYear(s.getFullYear() - Math.max(1, Number(nValue) || 1));
      start = startOfDay(s);
    }

    if (!start) return closedOrders.slice();

    return closedOrders.filter((o) => {
      const closedAtRaw = o?.closed_at || o?.closedAt || o?.updatedAt || o?.createdAt;
      if (!closedAtRaw) return false;
      const closed = new Date(closedAtRaw);
      return closed >= start && closed <= end;
    });
  };

  const applyFilter = () => {
    if (onFilter) onFilter(computeFiltered());
  };

  const resetFilter = () => {
    setRange("today");
    setNValue(1);
    setSelectedExpiredSymbol("");
    if (onFilter) onFilter(closedOrders.slice());
  };

  const showNumberInput = ["day", "month", "year"].includes(range);

  return (
    <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Filter Orders</h3>
      </div>

      <div>
        <label className="text-xs text-[var(--text-secondary)]">Time Range</label>
        <select
          value={range}
          onChange={(e) => { setRange(e.target.value); setSelectedExpiredSymbol(""); setNValue(1); }}
          className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500"
        >
          {RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {showNumberInput && (
        <div>
          <label className="text-xs text-[var(--text-secondary)]">Units back</label>
          <input
            type="number" min="1" value={nValue}
            onChange={(e) => setNValue(e.target.value)}
            className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
          />
        </div>
      )}

      {range === "expiry" && (
        <div>
          <label className="text-xs text-[var(--text-secondary)]">Select Symbol</label>
          <select
            value={selectedExpiredSymbol}
            onChange={(e) => setSelectedExpiredSymbol(e.target.value)}
            className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
          >
            <option value="">— All expired —</option>
            {expiredSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={applyFilter} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-sm transition-colors">Apply Filter</button>
        <button onClick={resetFilter} className="flex-1 py-2 bg-transparent border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">Reset</button>
      </div>
    </div>
  );
}

// ==========================================
// 1.5. PORTFOLIO SKELETON LOADER
// ==========================================
const PortfolioSkeleton = () => (
  <div className="flex flex-col space-y-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-[var(--bg-card)] rounded-3xl p-5 border border-[var(--border-color)] shadow-2xl animate-pulse">
        <div className="flex justify-between items-start mb-5">
          <div className="flex-1">
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/2 mb-2"></div>
            <div className="h-2 bg-[var(--bg-secondary)] rounded w-1/4"></div>
          </div>
          <div className="text-right">
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-16 mb-2 ml-auto"></div>
            <div className="h-6 bg-[var(--bg-secondary)] rounded-full w-20 ml-auto"></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)]/40 p-4 rounded-2xl border border-[var(--border-color)]/30 mb-5">
          {[1, 2, 3].map(j => (
            <div key={j} className="flex flex-col items-center gap-2">
              <div className="h-2 bg-[var(--bg-secondary)] rounded w-8"></div>
              <div className="h-3 bg-[var(--bg-secondary)] rounded w-12"></div>
            </div>
          ))}
        </div>
        <div className="h-12 bg-[var(--bg-secondary)] rounded-2xl w-full"></div>
      </div>
    ))}
  </div>
);

// ==========================================
// 2. PORTFOLIO ITEM CARD
// ==========================================
const PortfolioItem = ({ data, onClick }) => {
  const tradingsymbol = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "—";
  const { qty, entryPrice, exitPrice } = getOrderValues(data);
  const sideUpper = String(data.side ?? "").toUpperCase();
  const isBuy = sideUpper === "BUY";

  const { netPnl, pct } = calculateExitBrokerageAndPnL({
    side: sideUpper,
    avgPrice: entryPrice,
    exitPrice,
    qty,
    symbol: tradingsymbol
  });

  const profit = netPnl >= 0;
  const pnlChipBg = profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]";
  const pnlTextColorClass = profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]";
  const pnlArrow = profit ? "▲" : "▼";

  return (
    <div
      onClick={() => onClick(data)}
      className="bg-[var(--bg-card)] rounded-3xl p-5 border border-[var(--border-color)] shadow-2xl transition-all mb-4 cursor-pointer hover:brightness-105"
    >
      {/* Header: Title, Segment, Status & Price */}
      <div className="flex justify-between items-start mb-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-[var(--text-primary)] font-black text-base uppercase tracking-tight truncate">
              {tradingsymbol}
            </h4>
            <span className="text-[7px] font-black text-[var(--text-muted)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded uppercase">
              {data.segment || "NFO"}
            </span>
            <span className="text-[7px] font-black text-[var(--loss-text)] bg-[var(--loss-chip-bg)] px-1.5 py-0.5 rounded uppercase">
              CLOSED
            </span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase">
            <span>{data.product === 'MIS' ? 'Intraday' : 'Overnight'} • {data.segment || 'NFO'}</span>
            <span className={`px-1 rounded ${isBuy ? 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)]' : 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)]'}`}>
              {sideUpper}
            </span>
            <span>• {qty} QTY</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[var(--text-primary)] font-black text-lg leading-none mb-1.5">
            ₹{exitPrice.toFixed(2)}
          </div>
          <div className={`text-[9px] font-black px-2.5 py-1 rounded-full ${pnlChipBg} ${pnlTextColorClass}`}>
             {pnlArrow} {netPnl.toFixed(2)} ({profit ? "+" : ""}{pct.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]/30 mb-5 text-center">
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Entry Price</p>
          <p className="text-xs font-black text-[var(--text-primary)]">₹{entryPrice.toFixed(2)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Quantity</p>
          <p className="text-xs font-black text-[var(--text-primary)]">{qty}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Net P&L</p>
          <p className={`text-xs font-black ${pnlTextColorClass}`}>₹{netPnl.toFixed(2)}</p>
        </div>
      </div>

      {/* Action Button */}
      {/* <div className="w-full py-3.5 bg-[#3b82f6] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        <BarChart className="w-3.5 h-3.5" />
        View Details
      </div> */}
    </div>
  );
};

// ==========================================
// 3. MAIN PORTFOLIO COMPONENT
// ==========================================
export default function Portfolio() {
  const [allOrders, setAllOrders] = useState([]); // Raw data from API
  const [filteredOrders, setFilteredOrders] = useState([]); // Data shown in list
  const [summary, setSummary] = useState({ invested: 0, current: 0, totalPnl: 0 });
  const [loader, setLoader] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const navigate = useNavigate();

  // UI State for Switcher
  const [showFilter, setShowFilter] = useState(false);

  // API Params
  const activeContext = JSON.parse(localStorage.getItem('activeContext') || '{}');
  const { brokerId, customerId } = activeContext;
  const token = localStorage.getItem("token");

  // Fetch Data
  const fetchClosedOrders = async () => {
    console.log(`[Portfolio] Fetching for Broker: ${brokerId}, Customer: ${customerId}`);
    if (!brokerId || !customerId) {
      console.warn('[Portfolio] Missing context, skipping load');
      setLoader(false);
      return;
    }
    setLoader(true);
    try {
      const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || "";
      const url = `${baseUrl}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=CLOSED`;
      console.log('[Portfolio] API URL:', url);

      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!res.ok) {
        console.error('[Portfolio] API Error:', res.status);
        throw new Error("Failed");
      }
      const data = await res.json();
      console.log('[Portfolio] API Response:', data);
      const orders = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : [];
      const sortedOrders = [...orders].sort((a, b) => {
        const getTime = (o) => {
          const dates = [o.closed_at, o.closedAt, o.updatedAt, o.createdAt]
            .filter(Boolean)
            .map(d => new Date(d).getTime())
            .filter(t => !isNaN(t));
          return dates.length > 0 ? Math.max(...dates) : 0;
        };
        return getTime(b) - getTime(a);
      });

      setAllOrders(sortedOrders);
      setFilteredOrders(sortedOrders); // Initially show all
      calculateSummary(sortedOrders);
    } catch (err) {
      console.error('[Portfolio] Load Failed:', err);
    } finally {
      setLoader(false);
    }
  };

  // Recalculate summary based on visible orders
  const calculateSummary = (orders) => {
    const acc = orders.reduce((a, order) => {
      const { qty, entryPrice, exitPrice } = getOrderValues(order);
      const side = String(order.side ?? "").toUpperCase();

      const { entryValue, exitValue, netPnl } = calculateExitBrokerageAndPnL({
        side,
        avgPrice: entryPrice,
        exitPrice,
        qty,
        symbol: order.symbol || order.meta?.selectedStock?.tradingSymbol || ""
      });

      a.invested += entryValue;
      a.current += exitValue;
      a.totalPnl += netPnl;
      return a;
    }, { invested: 0, current: 0, totalPnl: 0 });

    setSummary(acc);
  };

  const handleFilterResult = (results) => {
    setFilteredOrders(results);
    calculateSummary(results);
    // Optional: Auto close filter on apply? 
    // setShowFilter(false); 
  };

  useEffect(() => {
    fetchClosedOrders();
    const handler = () => fetchClosedOrders();
    window.addEventListener('orders:changed', handler);
    return () => window.removeEventListener('orders:changed', handler);
  }, [brokerId, customerId, localStorage.getItem('activeContext')]);

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role;


  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">

      {/* Header with Switcher */}
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <h2 className="text-[26px] font-black tracking-tighter leading-none uppercase">Portfolio</h2>

        <div className="flex gap-2">
          {/* Invoice Button */}
          {userRole === 'broker' && <button
            onClick={() => navigate('/portfolio/invoice')}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] shadow-sm hover:bg-[var(--bg-hover)] transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            Invoice
          </button>}

          {/* Switcher Button */}
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`
                        flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 shadow-sm
                        ${showFilter
                ? "bg-[#3b82f6] text-white border-[#3b82f6] shadow-lg shadow-[#3b82f6]/20"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]"
              }
                    `}
          >
            {showFilter ? (
              <>
                <PieChart className="w-3.5 h-3.5" />
                Summary
              </>
            ) : (
              <>
                <Filter className="w-3.5 h-3.5" />
                Filter
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 mt-2">

        {/* SWAPPABLE AREA: Summary vs Filter */}
        <div className="mb-6 relative">
          {showFilter ? (
            <ClosedOrderFilter
              closedOrders={allOrders}
              onFilter={handleFilterResult}
            />
          ) : (
            <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] p-6 rounded-3xl shadow-xl shadow-blue-500/20 border-none animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
               {/* Subtle background decoration */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
               <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full -ml-12 -mb-12 blur-xl"></div>
               
              {/* Portfolio Summary Card */}
              <div className="flex flex-wrap justify-between items-start gap-4 mb-6 relative z-10">
                <div className="min-w-fit flex-1">
                  <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Total Invested</p>
                  <p className="text-2xl sm:text-3xl font-black text-white break-all leading-none">{money(summary.invested)}</p>
                </div>
                <div className="min-w-fit flex-1 text-right">
                  <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Realized Value</p>
                  <p className="text-2xl sm:text-3xl font-black text-white break-all leading-none">{money(summary.current)}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-5 border-t border-white/20 relative z-10">
                <p className="text-blue-100 text-[11px] font-black uppercase tracking-widest">Total Realized P&L</p>
                <span className={`text-lg sm:text-xl font-black px-4 py-1 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 whitespace-nowrap`}>
                  {summary.totalPnl >= 0 ? "+" : ""}{money(summary.totalPnl)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* List Header */}
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[2px] mb-4 flex items-center justify-between px-1">
          <span>Closed Positions ({filteredOrders.length})</span>
          {/* Show indicator if filtered */}
          {allOrders.length !== filteredOrders.length && (
            <span className="text-[8px] bg-[#3b82f6]/10 text-[#3b82f6] px-2 py-0.5 rounded-full border border-[#3b82f6]/20">Filtered</span>
          )}
        </h3>

        {/* The List */}
        {loader && <PortfolioSkeleton />}

        {!loader && filteredOrders.map((order, idx) => (
          <PortfolioItem
            key={order._id || idx}
            data={order}
            onClick={setSelectedOrder}
          />
        ))}

        {!loader && filteredOrders.length === 0 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-10 text-center flex flex-col items-center shadow-xl">
            <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4">
               <Filter className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
            </div>
            <p className="text-[var(--text-primary)] font-black uppercase text-sm mb-1">No orders found</p>
            {allOrders.length > 0 && <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">Try adjusting your filters</p>}
          </div>
        )}
      </div>

      {/* Helper Window - Uncomment when needed */}
      {/* {selectedOrder && (
                <ClosedOrderBottomWindow 
                    selectedOrder={selectedOrder} 
                    onClose={() => setSelectedOrder(null)} 
                />
            )} */}
    </div>
  );
}