import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import catalog from "./catalog.json";
import chapters from "./chapters.json";
import { relatedLessons } from "./relatedLessons";
import "./style.css";

const labels: Record<string, string> = {
  population: "Housing capacity",
  jobs: "Jobs",
  power: "Power",
  water: "Water",
  waste: "Waste capacity",
  food: "Food",
  education: "Education",
  recreation: "Recreation",
  government: "Government",
  police: "Police",
  policeRadius: "Police radius",
  fireRadius: "Fire radius",
  military: "Defense",
  income: "Base income",
  nuisanceRadius: "Nuisance radius",
};
const domains: Record<string, string> = {
  land: "Land",
  water: "Water",
  coast_or_water: "Coast or water",
  any: "Land or water",
};
const money = (n: number) => "$" + n.toLocaleString("en");
type Picture = { image: string; caption: string; alt: string; width: number; height: number };
type Lesson = {
  id: string;
  title: string;
  steps: string[];
  examples: Picture[];
  world?: string;
  summary?: string;
};
type Chapter = { id: string; title: string; label: string; intro: string; cover: string; lessons: Lesson[] };
const book: Chapter[] = chapters;
const worlds = book.find((chapter) => chapter.id === "worlds")?.lessons ?? [];
const playWorld = (id: string) => "./index.html#world=" + encodeURIComponent(id);
const asset = (path: string) => "./" + path.replace(/^\//, "");
const categories = Array.from(new Set(catalog.map((entry) => entry.categoryName)));
const readLocation = () => new URLSearchParams(location.hash.slice(1));
const link = (fields: Record<string, string>) =>
  "#" + new URLSearchParams(Object.entries(fields).filter(([, value]) => value)).toString();
const catalogUrl = link({ section: "catalog" });
function Plate({ pic }: { pic: Picture }) {
  return (
    <figure>
      <a href={asset(pic.image)} target="_blank" rel="noreferrer" aria-label={"Enlarge image · " + pic.alt}>
        <img src={asset(pic.image)} width={pic.width} height={pic.height} loading="lazy" alt={pic.alt} />
      </a>
      <figcaption>{pic.caption}</figcaption>
    </figure>
  );
}
function App() {
  const [route, setRoute] = useState(readLocation);
  const main = useRef<HTMLElement>(null);
  const entry = catalog.find((d) => d.id === route.get("design"));
  const section = entry ? "catalog" : route.get("section") || "start";
  const current = book.find((ch) => ch.id === section);
  const query = route.get("q") ?? "",
    category = route.get("category") ?? "";
  const lastPage = useRef(section + "|" + (entry?.id ?? ""));
  const jump = current?.lessons.find((lesson) => lesson.id === route.get("lesson"))?.id;
  useEffect(() => {
    const sync = () => setRoute(readLocation());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    const key = section + "|" + (entry?.id ?? "");
    document.title =
      (entry?.name ?? current?.title ?? (section === "catalog" ? "Design atlas" : "Island handbook")) +
      " · Pixel Civilization";
    if (lastPage.current !== key) {
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
      lastPage.current = key;
    }
    if (jump) document.getElementById(jump)?.scrollIntoView({ block: "start" });
  }, [section, entry, current, jump]);
  function filter(text: string, group: string) {
    const url = link({ section: "catalog", q: text, category: group });
    history.replaceState(null, "", url);
    setRoute(readLocation());
  }
  const library = link({ section: "catalog", q: query, category });
  const results = catalog.filter(
    (e) =>
      (!category || e.categoryName === category) &&
      (e.name + " " + e.categoryName + " " + e.usage + " " + e.description)
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <a
        className="skip"
        href="#content"
        onClick={(ev) => {
          ev.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to handbook
      </a>
      <header className="mast">
        <div>
          <a className="brand" href={link({ section: "start" })}>
            <b className="mark" aria-hidden="true">
              ▦
            </b>{" "}
            Pixel Civilization <span>/ Island handbook</span>
          </a>
          <a className="back" href="./index.html">
            Back to island <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <nav className="shelf" aria-label="Handbook chapters">
        <div>
          <a href={link({ section: "start" })} aria-current={section === "start" ? "page" : undefined}>
            Start here
          </a>
          {book.map((c) => (
            <a key={c.id} href={link({ section: c.id })} aria-current={section === c.id ? "page" : undefined}>
              {c.label}
            </a>
          ))}
          <a href={catalogUrl} aria-current={section === "catalog" ? "page" : undefined}>
            Design atlas
          </a>
        </div>
      </nav>
      <main id="content" ref={main} tabIndex={-1}>
        {entry ? (
          <>
            <div className="trail">
              <a href={library}>← Back to design atlas</a>
            </div>
            <div className="entry-intro">
              <div>
                <p className="category">{entry.categoryName}</p>
                <h1>{entry.name}</h1>
                <p className="lede">{entry.description}</p>
              </div>
              <a
                className="action"
                href={"./field-guide.html?id=" + entry.id + "&level=" + entry.maxLevel + "&variant=1"}
              >
                Rotate the model ↗
              </a>
            </div>
            <div className="article-grid">
              <div className="detail">
                <figure className="full-plate">
                  <a href={asset(entry.image)} target="_blank" rel="noreferrer">
                    <img src={asset(entry.image)} alt={entry.name + " in every level and visual style"} />
                  </a>
                  <figcaption>
                    Read left to right for levels and top to bottom for styles. Open the image to see the
                    individual voxels.
                  </figcaption>
                </figure>
              </div>
              <aside className="notes">
                <h2>On the island</h2>
                <p>{entry.usage}</p>
                <p>{entry.growth}</p>
                <h3>See it in play</h3>
                <ul>
                  {relatedLessons(entry.id, entry.category).map((lesson) => (
                    <li key={lesson.id}>
                      <a href={link({ section: lesson.section, lesson: lesson.id })}>{lesson.title}</a>
                    </li>
                  ))}
                </ul>
                <h3>Building requirements</h3>
                <dl className="facts">
                  <dt>Site</dt>
                  <dd>{domains[entry.domain] ?? entry.domain}</dd>
                  <dt>Construction</dt>
                  <dd>{money(entry.cost)}</dd>
                  <dt>Unlock</dt>
                  <dd>
                    {entry.wealthThreshold
                      ? money(entry.wealthThreshold) + " peak city wealth"
                      : entry.isStarter
                        ? "Starter catalog"
                        : "Stage " + entry.stage}
                  </dd>
                </dl>
                {Object.keys(entry.stats).length > 0 && (
                  <>
                    <h3>Level-one figures</h3>
                    <dl className="facts">
                      {Object.entries(entry.stats)
                        .filter(([, n]) => n !== undefined)
                        .map(([key, n]) => (
                          <React.Fragment key={key}>
                            <dt>{labels[key] ?? key}</dt>
                            <dd>
                              {n! > 0 ? "+" : ""}
                              {n}
                            </dd>
                          </React.Fragment>
                        ))}
                    </dl>
                    <p className="fine">
                      Local access, staffing and utilities affect what this site delivers in play.
                    </p>
                  </>
                )}
                <h3>Neighbor to try</h3>
                <a href={link({ design: entry.partner.id, q: query, category })}>{entry.partner.name} →</a>
                <h3>Footprint by level</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>Stage</th>
                      <th>Tiles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.levels.map((l) => (
                      <tr key={l.level}>
                        <td>
                          {l.level}
                          {l.legacy ? "*" : ""}
                        </td>
                        <td>{l.name}</td>
                        <td>{l.dimensions.join(" × ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {entry.levels.some((l) => l.legacy) && (
                  <p>* Existing saves can retain this level. New stops finish at level {entry.maxLevel}.</p>
                )}
                <h3>Visual styles</h3>
                <ul>
                  {entry.styles.map((v) => (
                    <li key={v.index}>
                      {String.fromCharCode(65 + v.index)} · {v.name}
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </>
        ) : section === "catalog" ? (
          <>
            <div className="title">
              <h1>Design atlas</h1>
              <p className="lede">
                Compare each element’s growth, footprint and four visual styles. Select a design to see the full
                sheet and how it works on the island.
              </p>
            </div>
            <form className="filters" onSubmit={(e) => e.preventDefault()}>
              <label>
                Search designs
                <input
                  type="search"
                  value={query}
                  onChange={(e) => filter(e.target.value, category)}
                  placeholder="Try cheesesteak, ferry or irrigation"
                />
              </label>
              <label>
                Category
                <select value={category} onChange={(e) => filter(query, e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <span aria-live="polite">
                {results.length} of {catalog.length} designs
              </span>
            </form>
            {!results.length && (
              <p>
                No designs match this search.{" "}
                <button className="text-button" onClick={() => filter("", "")}>
                  Clear filters
                </button>
              </p>
            )}
            <div className="gallery">
              {results.map((e) => (
                <a key={e.id} href={link({ design: e.id, q: query, category })}>
                  <img src={asset(e.thumbnail)} loading="lazy" alt="" />
                  <div>
                    <span>{e.categoryName}</span>
                    <strong>{e.name}</strong>
                  </div>
                </a>
              ))}
            </div>
          </>
        ) : current ? (
          <>
            <div className="title">
              <h1>{current.title}</h1>
              <p className="lede">{current.intro}</p>
            </div>
            <div className="chapter-grid">
              <aside className="contents">
                <h2>In this chapter</h2>
                {current.lessons.map((l) => (
                  <a
                    key={l.id}
                    href={link({ section: current.id, lesson: l.id })}
                    aria-current={jump === l.id ? "location" : undefined}
                  >
                    {l.title}
                  </a>
                ))}
              </aside>
              <article>
                {current.lessons.map((l) => (
                  <section className="lesson" key={l.id} id={l.id}>
                    <h2>{l.title}</h2>
                    {l.world && (
                      <a className="action play-island" href={playWorld(l.world)}>
                        Play this island <span aria-hidden="true">→</span>
                      </a>
                    )}
                    <ol>
                      {l.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                    <div className={l.examples.length > 1 ? "plates pair" : "plates"}>
                      {(l.world ? l.examples.slice(0, 3) : l.examples).map((pic) => (
                        <Plate key={pic.image} pic={pic} />
                      ))}
                    </div>
                    {l.world && l.examples.length > 3 && (
                      <details className="viewpoint-gallery">
                        <summary>See all viewpoints in {l.title}</summary>
                        <div className="plates pair">
                          {l.examples.slice(3).map((pic) => <Plate key={pic.image} pic={pic} />)}
                        </div>
                      </details>
                    )}
                  </section>
                ))}
              </article>
            </div>
          </>
        ) : (
          <>
            <div className="opening">
              <div className="opening-copy">
                <h1>Island handbook</h1>
                <p>
                  Follow a ferry to the open sea, feed a hillside farm from a mountain spring, or catch the
                  night train.
                </p>
                <a className="action" href={link({ section: "worlds" })}>
                  Tour the three islands <span aria-hidden="true">→</span>
                </a>
                <a className="inline-link" href={catalogUrl}>
                  Browse all {catalog.length} designs
                </a>
              </div>
              <img
                src="./handbook/worlds/pelican-reach.webp"
                alt="The ferry channel, road crossing and quays of Pelican Reach seen from above."
              />
            </div>
            <h2 className="collection-title">Playable islands</h2>
            <div className="world-cards">
              {worlds.map((world) => (
                <article key={world.id}>
                  <img
                    src={asset("/handbook/worlds/" + world.id + ".webp")}
                    width="960"
                    height="600"
                    alt=""
                    loading="lazy"
                  />
                  <div>
                    <h3>{world.title}</h3>
                    <p>{world.summary}</p>
                    <a className="action" href={playWorld(world.id)} aria-label={"Play " + world.title}>
                      Play island <span aria-hidden="true">→</span>
                    </a>
                    <a
                      className="inline-link"
                      href={link({ section: "worlds", lesson: world.id })}
                      aria-label={"View " + world.title + " tour"}
                    >
                      View tour
                    </a>
                  </div>
                </article>
              ))}
            </div>
            <h2 className="collection-title">Playing the island</h2>
            <div className="chapters">
              {book
                .filter((c) => c.id !== "worlds")
                .map((c) => (
                  <a key={c.id} href={link({ section: c.id })}>
                    <img src={asset(c.cover)} loading="lazy" alt="" />
                    <div>
                      <h3>{c.title}</h3>
                      <p>{c.intro}</p>
                    </div>
                  </a>
                ))}
            </div>
          </>
        )}
      </main>
      <footer>
        <a href={link({ section: "start" })}>Island handbook</a>
        <a href="./field-guide.html">3D field guide ↗</a>
      </footer>
    </>
  );
}
createRoot(document.getElementById("handbook")!).render(<App />);
