import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import ArticlePage from "./pages/ArticlePage";
import CategoryPage from "./pages/CategoryPage";
import AdminLogin from "./pages/AdminLogin";
import AdminPage from "./pages/AdminPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import RSSPage from "./pages/RSSPage";
import ContactPage from "./pages/ContactPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/"              element={<Index />} />
          <Route path="/article/:id"   element={<ArticlePage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/admin-login"   element={<AdminLogin />} />
          <Route path="/admin-panel"   element={<AdminPage />} />
          <Route path="/privacy"       element={<PrivacyPage />} />
          <Route path="/terms"         element={<TermsPage />} />
          <Route path="/rss"           element={<RSSPage />} />
          <Route path="/contact"       element={<ContactPage />} />
          <Route path="*"              element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;