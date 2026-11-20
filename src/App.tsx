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

export function App() {
  return (
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
  );
}

export default App;
