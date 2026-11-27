import { Suspense, lazy, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Biography } from "./components/Biography";
import { Contact } from "./components/Contact";
import { Experience } from "./components/Experience";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Projects } from "./components/Projects";
import { Skills } from "./components/Skills";
import { PortraitJourney } from "./components/ui/PortraitJourney";
import { PortfolioProvider } from "./context/PortfolioContext";

const AdminApp = lazy(() => import("./admin/AdminApp"));

function isAdminRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return path === "/admin" || hash === "#/admin" || hash.startsWith("#/admin/");
}

function PublicPortfolio() {
  return (
    <PortfolioProvider>
      <MotionConfig reducedMotion="user">
        <Header />
        <main id="main">
          <section id="about" className="about-section">
            <PortraitJourney />
            <Hero />
            <Biography />
          </section>
          <Skills />
          <Projects />
          <Experience />
          <Contact />
        </main>
        <Footer />
      </MotionConfig>
    </PortfolioProvider>
  );
}

export function App() {
  const [adminMode, setAdminMode] = useState(isAdminRoute);

  useEffect(() => {
    const sync = () => setAdminMode(isAdminRoute());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  if (adminMode) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100dvh",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              color: "var(--sc-ink-soft)",
            }}
          >
            Loading Admin Studio...
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    );
  }

  return <PublicPortfolio />;
}

export default App;
