import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import LoginModal from "../Login/LoginModal";
import PageLoader from "../PageLoader/PageLoader";
import "./home.css";

// Image Imports
import img1 from "./image1.jpg";
import img2 from "./image2.jpg";
import img3 from "./image3.jpg";
import img4 from "./image4.jpg";
import img5 from "./image5.jpg";
import img6 from "./image6.jpg";

function Home() {
  const imagesLeft = [img1, img2, img3];
  const imagesRight = [img4, img5, img6];

  const [indexLeft, setIndexLeft] = useState(0);
  const [indexRight, setIndexRight] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // Section refs for smooth scrolling
  const homeRef = useRef(null);
  const featuresRef = useRef(null);
  const aboutRef = useRef(null);

  // Scroll functions
  const scrollToTop = () => {
    homeRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const scrollToAbout = () => {
    aboutRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Image Slideshow Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setIndexLeft((prev) => (prev + 1) % imagesLeft.length);
      setIndexRight((prev) => (prev + 1) % imagesRight.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [imagesLeft.length, imagesRight.length]);

  // Page Loader Logic
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  // Scroll-triggered slide up + fade in logic (repeats every time, header-aware)
  useEffect(() => {
    const header = document.querySelector(".home-header");
    const headerHeight = header ? header.offsetHeight : 70;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
          } else {
            entry.target.classList.remove("reveal-visible");
          }
        });
      },
      {
        threshold: 0,
        rootMargin: `-${headerHeight}px 0px 0px 0px`,
      }
    );

    const elements = document.querySelectorAll(".reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [loading]);

  return (
    <div className="home-page" ref={homeRef}>
      {/* --- PAGE LOADER --- */}
      <PageLoader visible={loading} />

      {/* --- HEADER --- */}
      <header className="home-header">
        <h1 className="title">Webscript AI</h1>
        <nav className="nav-buttons">
          <button className="nav-button" onClick={scrollToTop}>
            Home
          </button>
          <button className="nav-button" onClick={scrollToFeatures}>
            Features
          </button>
          <button className="nav-button" onClick={scrollToAbout}>
            About
          </button>
        </nav>
        <div className="webscript-button-wrapper">
          <button
            className="webscript-button"
            onClick={() => setShowLogin(true)}
          >
            Log in
          </button>
        </div>
      </header>

      {/* --- MODAL --- */}
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLoginSuccess={() => {
          setShowLogin(false);
          navigate("/ui");
        }}
      />

      {/* --- HERO SECTION --- */}
      <main className="home-content1 reveal">
        <h2>Unlock the future of coding with WebScript AI Analytics</h2>
      </main>

      {/* --- FEATURES SECTION --- */}
      <section className="home-content2 reveal">
        <h3>
          where powerful AI meets intuitive analytics to supercharge your code
          testing, debugging, and optimization.
        </h3>
      </section>

      {/* --- ABOUT SECTION --- */}
      <section className="home-content3 reveal">
        <h3>Simplify your workflow and boost efficiency like never before!</h3>
      </section>

      {/* --- CTA SECTION --- */}
      <div className="center-button reveal">
        <Link to="/guest" style={{ textDecoration: "none" }}>
          <button className="testing-button">Start Testing Now</button>
        </Link>
      </div>

      {/* --- FIRST IMAGE SECTION --- ref for Features button --- */}
      <section className="home-content4 reveal" ref={featuresRef}>
        <h3>
          Accelerate Decisions with WebScript's AI-Powered Analytics Engine.
        </h3>
      </section>

      <section className="image-section reveal">
        <div className="image-box">
          {imagesLeft.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`Left slide ${i + 1}`}
              className={`fade-image ${i === indexLeft ? "active" : ""}`}
            />
          ))}
        </div>
      </section>

      {/* --- SECOND IMAGE SECTION --- */}
      <section className="home-content4 reveal">
        <h3>Unleash the Power of AI-Driven Analytics with WebScript.</h3>
      </section>

      <section className="image-section reveal">
        <div className="image-box">
          {imagesRight.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`Right slide ${i + 1}`}
              className={`fade-image ${i === indexRight ? "active" : ""}`}
            />
          ))}
        </div>
      </section>

      {/* --- ABOUT SECTION --- ref for About button --- */}
      <section className="home-content-about reveal" ref={aboutRef}>
        <h3>About Us</h3>
      </section>

      <div className="AboutUs reveal">
        <p>
          We are a passionate group of four students from{" "}
          <strong>Our Lady of Fatima University</strong>, pursuing a Bachelor of
          Science in Computer Science.
        </p>
        <p>
          Our team is dedicated to creating innovative web solutions and
          exploring the power of AI in software development.
        </p>
        <p>
          <strong>Meet the team:</strong>
        </p>
        <p>Patrick E. Ho</p>
        <p>Eric Geoff A. Lomibao</p>
        <p>Stephen Kyle A. Salazar</p>
        <p>Rolan Marcus V. Saac</p>
        <p>
          Together, we aim to combine creativity, coding skills, and teamwork
          to build projects that make a difference.
        </p>
      </div>

      {/* --- FOOTER CTA --- */}
      <div className="try reveal">
        <h3>Join us and learn more about Webscript AI Analytics.</h3>
        <Link to="/guest" style={{ textDecoration: "none" }}>
          <button className="trybutton">Try Webscript AI Now</button>
        </Link>
      </div>

      <hr className="divider" />

      {/* --- FOOTER --- */}
      <footer className="footer reveal">
        <p>© 2025 Web Script AI. All rights reserved.</p>
        <p>Build smarter, code faster with AI assistance.</p>
      </footer>
    </div>
  );
}

export default Home;