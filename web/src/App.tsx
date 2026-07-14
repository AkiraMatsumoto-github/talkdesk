import { Route, Routes } from "react-router-dom";
import { Login, PasswordReset } from "./pages/Login";
import { AppShell } from "./layout/AppShell";
import { OpsRoutes } from "./pages/Ops";
import { ToastStack } from "./components/ui";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/password-reset" element={<PasswordReset />} />
        <Route path="/ops/*" element={<OpsRoutes />} />
        <Route path="/w/:orgId/*" element={<AppShell />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
      <ToastStack />
    </>
  );
}
