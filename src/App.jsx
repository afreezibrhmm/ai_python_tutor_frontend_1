import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from "./login.jsx";
import Tutor from "./tutor.jsx";
import Admin from "./admin.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/tutor" element={<Tutor />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
