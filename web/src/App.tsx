import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";
import { Login, PasswordReset } from "./pages/Login";
import { AppShell } from "./layout/AppShell";
import { OpsRoutes } from "./pages/Ops";
import { ToastStack } from "./components/ui";

function RootLayout() {
  return (
    <>
      <Outlet />
      <ToastStack />
    </>
  );
}

// data router（useBlockerによる離脱ブロック PERM-2 のため）
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/password-reset", element: <PasswordReset /> },
      { path: "/ops/*", element: <OpsRoutes /> },
      { path: "/w/:orgId/*", element: <AppShell /> },
      { path: "/*", element: <AppShell /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
