import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import "./index.css";
import "./styles/tailwind.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

const Router = ({ children }: { children: React.ReactNode }) => {
  const useHash = (process.env.REACT_APP_ROUTER_MODE ?? "").toLowerCase() === "hash";
  const basename = process.env.PUBLIC_URL || "/";
  if (useHash) {
    return <HashRouter basename={basename}>{children}</HashRouter>;
  }
  return <BrowserRouter basename={basename}>{children}</BrowserRouter>;
};

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
