// VideoModal.jsx — plays a YouTube video inline in a lightbox, without leaving the site
import { useEffect } from "react";

export function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:shorts\/|youtu\.be\/|[?&]v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function VideoModal({ videoId, title, onClose }) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!videoId) return null;

  return (
    <div className="video-modal-backdrop" onClick={onClose}>
      <div className="video-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="video-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="video-modal-frame">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title || "Video player"}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
