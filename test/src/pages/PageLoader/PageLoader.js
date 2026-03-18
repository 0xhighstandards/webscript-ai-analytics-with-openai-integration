import { useEffect, useRef } from "react";
import "./PageLoader.css";

function PageLoader({ visible }) {
  const typedRef = useRef(null);
  const subRef = useRef(null);
  const cursorRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    const text = "Webscript AI";
    const el = typedRef.current;
    const sub = subRef.current;
    if (!el || !sub) return;

    el.textContent = "";
    sub.style.opacity = 0;
    let i = 0;

    const interval = setInterval(() => {
      if (i < text.length) {
        el.textContent += text[i];
        i++;
      } else {
        clearInterval(interval);
        sub.style.opacity = 1;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [visible]);

  return (
    <div className={`page-loader ${visible ? "" : "hidden"}`}>
      <div className="loader-content">
        <div className="loader-typing-wrapper">
          <span ref={typedRef} className="loader-typed"></span>
          <span ref={cursorRef} className="loader-cursor">|</span>
        </div>
        <div ref={subRef} className="loader-sub">Loading...</div>
      </div>
    </div>
  );
}

export default PageLoader;