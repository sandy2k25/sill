import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import Logs from "@/pages/logs";
import NotFound from "@/pages/not-found";
import Error404 from "@/pages/error404";
import AuthPage from "@/pages/auth-page";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Protected route component
function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType, path: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // If we're already on the auth page, don't redirect again
  if (location === '/auth') {
    return <Component />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Use location state to remember where we came from
    setLocation("/auth");
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Error404} />
      <Route path="/taah/:id">
        {(params) => <ProtectedRoute component={Home} path="/taah/:id" />}
      </Route>
      <Route path="/auth" component={AuthPage} />
      <Route path="/home">
        {(params) => <ProtectedRoute component={Home} path="/home" />}
      </Route>
      <Route path="/admin">
        {(params) => <ProtectedRoute component={Admin} path="/admin" />}
      </Route>
      <Route path="/logs">
        {(params) => <ProtectedRoute component={Logs} path="/logs" />}
      </Route>
      <Route component={Error404} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Layout>
            <Router />
          </Layout>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
