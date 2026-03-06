import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home/home";
import UI from "./pages/UI/ui";
import Guest from "./pages/Guest/guest";
import LoginModal from "./pages/Login/LoginModal";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/LoginModal" element={<LoginModal />} />
      <Route path="/ui" element={<UI />} />
      <Route path="/guest" element={<Guest />} />
    </Routes>
  );
}

export default App;
