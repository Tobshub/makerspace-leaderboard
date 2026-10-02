import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Shell from "./components/Shell";
import { useRoute } from "./hooks";
import ActivityPage from "./pages/ActivityPage";
import Display from "./pages/Display";
import Home from "./pages/Home";
import StagePage from "./pages/StagePage";
import { useActivity } from "./store";
import { STAGE_ORDER, type StageId } from "./types";
import "./index.css";

function NotFound() {
  return (
    <Shell>
      <div className="wrap section">
        <div className="empty">
          That activity doesn't exist on this device.
          <div style={{ marginTop: 20 }}>
            <a className="btn btn--sm" href="#/">
              All activities
            </a>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function App() {
  const [section, id, stage] = useRoute();
  const activity = useActivity(section === "a" || section === "display" ? id : undefined);

  if (!section) return <Home />;
  if (!activity) return <NotFound />;
  if (section === "display") return <Display activity={activity} />;
  if (stage && STAGE_ORDER.includes(stage as StageId))
    return <StagePage key={stage} activity={activity} stageId={stage as StageId} />;
  return <ActivityPage activity={activity} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
