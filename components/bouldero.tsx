"use client";
import { useEffect, useRef, useState } from "react";
import HoldMap from "./hold-map";
import { cloudEnabled, listProjects, saveProject } from "@/lib/storage";
import { preparePhoto } from "@/lib/photo";
import { reorder } from "@/lib/coordinates";
import type { Hold, Project } from "@/lib/types";

function Arrow({ back = false }: { back?: boolean }) {
  return <span aria-hidden="true">{back ? "←" : "↗"}</span>;
}
function BoulderArt() {
  return (
    <svg
      className="boulder-art"
      viewBox="0 0 500 400"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M51 347c70-12 116-7 176-5s147 11 220-5"
        stroke="#bec3b3"
        strokeWidth="2"
      />
      <path
        d="m82 323 28-126 99-111 118-20 84 83 25 155-68 31-221-2Z"
        fill="#dedfd2"
      />
      <path d="m110 197 99-111 31 132-93 115-65-10Z" fill="#c9cebb" />
      <path d="m209 86 118-20-35 128-52 24Z" fill="#ececdf" />
      <path d="m292 194 119-45 25 155-68 31-128-117Z" fill="#d3d7c5" />
      <path
        d="m209 86 31 132 52-24 35-128M240 218l-93 115"
        stroke="#b7beaa"
        strokeWidth="1.5"
      />
      <path d="m166 236 15-16 14 4-2 15-17 9Z" fill="#778568" />
      <path d="m208 177 12-13 12 5-4 15-15 2Z" fill="#7e8d6b" />
      <path d="m270 137 15-8 14 9-6 12-20-2Z" fill="#879671" />
      <path d="m313 97 13-5 13 10-9 10-18-3Z" fill="#6f805f" />
      <path d="m248 277 19-8 12 14-9 10-22-3Z" fill="#869873" />
      <path
        d="m273 286-48-55-1-52 58-38 42-41"
        stroke="#fbfcf4"
        strokeWidth="2"
        strokeDasharray="5 7"
      />
      <circle cx="225" cy="231" r="18" fill="#e5f7ac" />
      <text
        x="225"
        y="236"
        textAnchor="middle"
        fontSize="14"
        fontFamily="sans-serif"
        fill="#34442b"
      >
        1
      </text>
      <circle cx="225" cy="179" r="18" fill="#e5f7ac" />
      <text
        x="225"
        y="184"
        textAnchor="middle"
        fontSize="14"
        fontFamily="sans-serif"
        fill="#34442b"
      >
        2
      </text>
      <circle cx="284" cy="140" r="18" fill="#e5f7ac" />
      <text
        x="284"
        y="145"
        textAnchor="middle"
        fontSize="14"
        fontFamily="sans-serif"
        fill="#34442b"
      >
        3
      </text>
      <path
        d="m385 66 4-13m10 24 12-6m-24-24-4-11"
        stroke="#8e9d73"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Bouldero() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [screen, setScreen] = useState<"projects" | "new" | "project">(
    "projects",
  );
  const [opened, setOpened] = useState<Project | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [holds, setHolds] = useState<Hold[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [gym, setGym] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const uploading = useRef(false);
  const projectsRef = useRef<Project[]>([]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);
  async function refresh() {
    const next = await listProjects();
    projectsRef.current.forEach((p) => {
      if (p.photo_url.startsWith("blob:")) URL.revokeObjectURL(p.photo_url);
    });
    projectsRef.current = next;
    setProjects(next);
    return next;
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => {
      projectsRef.current.forEach((p) => {
        if (p.photo_url.startsWith("blob:")) URL.revokeObjectURL(p.photo_url);
      });
    };
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (screen !== "new" || !photo) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [screen, photo]);
  function start() {
    setName("");
    setGrade("");
    setGym("");
    setHolds([]);
    setSelected("");
    setPhoto(null);
    setPreview("");
    setError("");
    setScreen("new");
  }
  function back() {
    if (busy) return;
    if (
      screen === "new" &&
      photo &&
      !window.confirm("Discard this unsaved project?")
    )
      return;
    setError("");
    setScreen("projects");
    setPhoto(null);
    setPreview("");
  }
  async function choose(file?: File) {
    if (!file || uploading.current) return;
    uploading.current = true;
    setBusy(true);
    setError("");
    try {
      const blob = await preparePhoto(file);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
      setHolds([]);
      setSelected("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open photo.");
    } finally {
      setBusy(false);
      uploading.current = false;
    }
  }
  async function save() {
    if (!photo || !name.trim() || !holds.length || busy) return;
    setBusy(true);
    setError("");
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      grade: grade.trim(),
      gym: gym.trim(),
      photo_url: "",
      status: "active",
      created_at: new Date().toISOString(),
      sent_at: null,
      holds,
    };
    try {
      await saveProject(project, photo);
      // Do not invite a duplicate save if reloading the list fails after commit.
      setScreen("projects");
      setPhoto(null);
      setPreview("");
      setNotice("Project saved. Your next climb starts here.");
      const next = await refresh();
      setOpened(next.find((p) => p.id === project.id)!);
      setScreen("project");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save the project. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const active = projects.filter((p) => p.status === "active");
  const sent = projects.filter((p) => p.status === "sent");
  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={back} aria-label="Bouldero home">
          <span className="brand-mark">
            b<span>·</span>
          </span>
          bouldero<span className="brand-period">.</span>
        </button>
        <div className="header-note">
          <span className="status-dot" /> ONE HOLD AT A TIME
        </div>
        <span className="version">FIELD NOTES / V0.1</span>
      </header>
      <main>
        {error && (
          <div className="error" role="alert">
            {error}
            {screen === "projects" && (
              <button
                onClick={() => {
                  setError("");
                  setLoading(true);
                  refresh()
                    .catch((e) => setError(e.message))
                    .finally(() => setLoading(false));
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
        {screen === "projects" && (
          <>
            <section className="page-intro">
              <div>
                <p className="eyebrow">YOUR CLIMBING NOTEBOOK</p>
                <h1>
                  A little progress.
                  <br />
                  <span>Every climb.</span>
                </h1>
                <p className="intro-copy">
                  Big moves start with small ones. Keep your projects here.
                </p>
              </div>
              <button className="button primary new-project" onClick={start}>
                <span className="plus">+</span> New project <Arrow />
              </button>
            </section>
            <div className="section-heading">
              <h2>
                Active projects{" "}
                <span className="count">
                  {active.length.toString().padStart(2, "0")}
                </span>
              </h2>
              <span className="small-note">
                A work in progress. Just like us.
              </span>
            </div>
            {loading ? (
              <div className="empty-card loading">Opening your notebook…</div>
            ) : active.length === 0 ? (
              <section className="empty-card">
                <div className="art-wrap">
                  <span className="art-tag">THE NEXT MOVE IS YOURS</span>
                  <BoulderArt />
                </div>
                <div className="empty-copy">
                  <span className="mini-label">01 / START SOMETHING</span>
                  <h2>
                    Meet your next
                    <br />
                    little obsession.
                  </h2>
                  <p>
                    That route you can’t stop thinking about?
                    <br className="desktop-break" /> Give it a home. Snap a
                    photo, mark the holds,
                    <br className="desktop-break" /> and make it your project.
                  </p>
                  <button className="button dark" onClick={start}>
                    Create your first project <Arrow />
                  </button>
                  <span className="under-button">
                    Just you, a wall, and a starting point.
                  </span>
                </div>
              </section>
            ) : (
              <div className="project-grid">
                {active.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    open={() => {
                      setOpened(project);
                      setScreen("project");
                    }}
                  />
                ))}
                <button className="add-card" onClick={start}>
                  <span>+</span>Something caught your eye?
                  <strong>
                    Add a project <Arrow />
                  </strong>
                </button>
              </div>
            )}
            <section className="sent-section">
              <div className="section-heading">
                <h2>
                  Sent{" "}
                  <span className="count">
                    {sent.length.toString().padStart(2, "0")}
                  </span>
                </h2>
                <span className="tiny-spark">✳</span>
              </div>
              {sent.length ? (
                <div className="project-grid">
                  {sent.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      open={() => {
                        setOpened(project);
                        setScreen("project");
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="sent-empty">
                  A home for the ones you finish. You’ll get there.
                </p>
              )}
            </section>
            <div className="how-it-works">
              <span className="mini-label">A SIMPLE START</span>
              <div>
                <span>01</span>
                <strong>Capture the route</strong>
                <p>A photo of your next project.</p>
              </div>
              <div>
                <span>02</span>
                <strong>Make your map</strong>
                <p>Mark the holds, from start to top.</p>
              </div>
              <div>
                <span>03</span>
                <strong>Come back to it</strong>
                <p>Your project, right where you left it.</p>
              </div>
            </div>
          </>
        )}
        {screen === "new" && (
          <>
            <button className="back-button" disabled={busy} onClick={back}>
              <Arrow back /> All projects
            </button>
            <div className="editor-heading">
              <div>
                <p className="eyebrow">A NEW BEGINNING</p>
                <h1>Make it a project.</h1>
                <p className="intro-copy">
                  A photo. A few holds. A place to start.
                </p>
              </div>
              <span className="step-label">
                {photo ? "02 / MAP YOUR ROUTE" : "01 / CHOOSE A PHOTO"}
              </span>
            </div>
            {!photo ? (
              <div className="upload-panel">
                <div className="upload-icon">↥</div>
                <h2>First, meet the wall.</h2>
                <p>
                  Choose a clear photo of your route.
                  <br />
                  Keep the start and the top in frame.
                </p>
                <label className={`button primary ${busy ? "disabled" : ""}`}>
                  Choose a photo <Arrow />
                  <input
                    aria-label="Choose a photo"
                    type="file"
                    accept="image/*"
                    disabled={busy}
                    onChange={(e) => choose(e.target.files?.[0])}
                  />
                </label>
                <label className="camera-link">
                  Take a photo
                  <input
                    aria-label="Take a photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={busy}
                    onChange={(e) => choose(e.target.files?.[0])}
                  />
                </label>
                <span className="small-note">
                  {busy
                    ? "Preparing your photo…"
                    : "JPEG, PNG or WebP · up to 30 MB"}
                </span>
              </div>
            ) : (
              <div className="editor-layout">
                <section className="mapping-panel">
                  <div className="map-heading">
                    <strong>Tap each hold in climbing order.</strong>
                    <span>{holds.length} holds</span>
                  </div>
                  <HoldMap
                    src={preview}
                    holds={holds}
                    editable={!busy}
                    selected={selected}
                    onSelect={setSelected}
                    onChange={setHolds}
                  />
                  <div className="map-toolbar">
                    <button
                      className="button secondary"
                      disabled={!holds.length || busy}
                      onClick={() => {
                        setHolds(holds.slice(0, -1));
                        setSelected("");
                      }}
                    >
                      ↶ Undo last hold
                    </button>
                    <button
                      className="text-button danger"
                      disabled={!selected || busy}
                      onClick={() => {
                        setHolds(
                          reorder(holds.filter((h) => h.id !== selected)),
                        );
                        setSelected("");
                      }}
                    >
                      Delete selected
                    </button>
                  </div>
                  <p className="map-hint">
                    Drag a marker to move it. Tap a marker to select it.
                    <br />
                    With a keyboard, use arrow keys to move the selected marker.
                  </p>
                </section>
                <form
                  className="details-panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save();
                  }}
                >
                  <span className="mini-label">THE LITTLE DETAILS</span>
                  <h2>What’s the project?</h2>
                  <label>
                    Project name{" "}
                    <input
                      autoComplete="off"
                      placeholder="The purple one"
                      maxLength={80}
                      required
                      value={name}
                      disabled={busy}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Grade <span>optional</span>
                    <input
                      placeholder="e.g. V4 or 6B"
                      maxLength={24}
                      value={grade}
                      disabled={busy}
                      onChange={(e) => setGrade(e.target.value)}
                    />
                  </label>
                  <label>
                    Gym <span>optional</span>
                    <input
                      placeholder="Your local spot"
                      maxLength={100}
                      value={gym}
                      disabled={busy}
                      onChange={(e) => setGym(e.target.value)}
                    />
                  </label>
                  <label className="top-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(holds.at(-1)?.is_top)}
                      disabled={!holds.length || busy}
                      onChange={(e) =>
                        setHolds(
                          holds.map((h, i) => ({
                            ...h,
                            is_top: i === holds.length - 1 && e.target.checked,
                          })),
                        )
                      }
                    />
                    <span>
                      Mark the final hold as <strong>TOP</strong>
                      <small>This is where the route finishes.</small>
                    </span>
                  </label>
                  <button
                    className="button primary save-button"
                    disabled={busy || !name.trim() || !holds.length}
                  >
                    {busy ? "Saving your project…" : "Done · Save project"}
                    <Arrow />
                  </button>
                  <p className="save-note">
                    {!holds.length
                      ? "Add at least one hold to save your route."
                      : `${holds.length} holds mapped. Ready when you are.`}
                  </p>
                </form>
              </div>
            )}
          </>
        )}
        {screen === "project" && opened && (
          <>
            <button className="back-button" onClick={back}>
              <Arrow back /> All projects
            </button>
            <div className="editor-heading">
              <div>
                <p className="eyebrow">YOUR ROUTE, MAPPED</p>
                <h1>{opened.name}</h1>
                <p className="intro-copy">
                  {[opened.grade, opened.gym].filter(Boolean).join(" · ") ||
                    "A new project. A fresh start."}
                </p>
              </div>
              <span className="pill">
                {opened.status === "sent" ? "Sent" : "Active project"}
              </span>
            </div>
            <div className="editor-layout">
              <section className="mapping-panel">
                <HoldMap src={opened.photo_url} holds={opened.holds} />
              </section>
              <aside className="project-details">
                <span className="mini-label">YOUR STARTING POINT</span>
                <h2>Ready for the wall.</h2>
                <p>
                  Your route and hold map are saved.
                  <br />
                  Come back whenever you’re ready.
                </p>
                <dl>
                  <div>
                    <dt>Holds mapped</dt>
                    <dd>{opened.holds.length}</dd>
                  </div>
                  <div>
                    <dt>Top hold</dt>
                    <dd>
                      {opened.holds.some((h) => h.is_top)
                        ? `Hold ${opened.holds.length}`
                        : "Not marked"}
                    </dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>
                      {new Date(opened.created_at).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="milestone-note">
                  <span>↗</span>
                  <p>
                    <strong>One step at a time.</strong>Photo mapping is ready
                    to try. Attempt logging comes in the next milestone.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer>
        <span>
          bouldero. <span className="footer-tagline">Keep showing up.</span>
        </span>
        <span>
          {cloudEnabled ? "Private cloud workspace" : "Saved on this device"}
          <span className="footer-dot">·</span>Milestone 01
        </span>
      </footer>
      {!cloudEnabled && (
        <p className="local-note">
          Local mode · Projects stay in this browser. Clearing site data removes
          them. Connect Supabase for cloud storage.
        </p>
      )}
      {notice && (
        <div className="toast" role="status">
          ✓ {notice}
        </div>
      )}
    </div>
  );
}
function ProjectCard({
  project,
  open,
}: {
  project: Project;
  open: () => void;
}) {
  return (
    <button className="project-card" onClick={open}>
      <div className="card-photo">
        <img src={project.photo_url} alt={project.name} />
        <span className="card-badge">{project.grade || "PROJECT"}</span>
        <span className="card-arrow">
          <Arrow />
        </span>
      </div>
      <div className="card-copy">
        <h3>{project.name}</h3>
        <p>
          {project.holds.length} holds mapped
          <span>
            {project.holds.some((h) => h.is_top) ? "TOP marked" : "Route saved"}
          </span>
        </p>
      </div>
    </button>
  );
}
