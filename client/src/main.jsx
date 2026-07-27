import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { CurrencyProvider } from "./context/CurrencyContext.jsx";
import { ShopperAuthProvider } from "./context/ShopperAuthContext.jsx";
import { StoreHostProvider } from "./context/StoreHostContext.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreHostProvider>
        <AuthProvider>
          <ShopperAuthProvider>
            <CurrencyProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </CurrencyProvider>
          </ShopperAuthProvider>
        </AuthProvider>
      </StoreHostProvider>
    </BrowserRouter>
  </React.StrictMode>
);
