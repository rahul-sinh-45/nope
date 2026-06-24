// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import App from "./App.jsx";
import "./index.css";
import MarketTestWidget from "./components/MarketTestWidget";

// ── Session Persistence: Restore auth header on app start ──
const savedToken = localStorage.getItem('token');
if (savedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

// ── Global 401 Interceptor: Auto-logout on expired token ──
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/' && currentPath !== '/login' && currentPath !== '/register') {
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('activeContext');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);
