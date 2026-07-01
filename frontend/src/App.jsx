// App.jsx — assembles the page: your preserved design (top, showcase, footer)
// with the new Live Feed dropped in where the old reels used to be, plus a
// dependency-free hash route for the Archive page (#/archive).
import { useEffect, useState } from "react";
import StaticSection from "./components/StaticSection.jsx";
import LiveFeed from "./components/LiveFeed.jsx";
import Archive from "./components/Archive.jsx";
import AppsGrid from "./components/AppsGrid.jsx";
import { topHtml, showcaseHtml, footerHtml } from "./lib/staticHtml.js";

function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash.replace(/^#/, "") || "/");
  useEffect(() => {
    const onChange = () => setRoute(window.location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();

  // keep the footer © year fresh (the original page did this in JS)
  useEffect(() => {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }, [route]);

  // pause the marquee ticker on hover, exactly like the original
  useEffect(() => {
    const wrap = document.querySelector(".ticker-wrap");
    const ticker = document.querySelector(".ticker");
    if (!wrap || !ticker) return;
    const pause = () => (ticker.style.animationPlayState = "paused");
    const run = () => (ticker.style.animationPlayState = "running");
    wrap.addEventListener("mouseenter", pause);
    wrap.addEventListener("mouseleave", run);
    return () => { wrap.removeEventListener("mouseenter", pause); wrap.removeEventListener("mouseleave", run); };
  }, [route]);

  // make each app card clickable (preserves original behaviour)
  useEffect(() => {
    document.querySelectorAll("#showcase .proj-card").forEach((card) => {
      const cta = card.querySelector(".proj-card-cta a");
      if (!cta || !cta.href) return;
      card.style.cursor = "pointer";
      card.onclick = (e) => { if (!e.target.closest("a")) window.open(cta.href, "_blank", "noopener"); };
    });
  }, [route]);

  if (route.startsWith("/archive")) {
    return <Archive />;
  }

  return (
    <>
      <StaticSection html={topHtml} />
      <LiveFeed />
      <StaticSection html={showcaseHtml} />
      <AppsGrid />
      <StaticSection html={footerHtml} />
    </>
  );
}
