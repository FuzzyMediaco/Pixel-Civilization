import reviewKey from "../docs/review/rome-pilot/review-key.json";

const photos = import.meta.glob("../docs/review/rome-pilot/*.webp", {
  eager: true, import: "default", query: "?url",
}) as Record<string, string>;
const photo = (id: string) => photos[`../docs/review/rome-pilot/${id}.webp`];
const camera = document.querySelector<HTMLSelectElement>("#camera")!;
const pass = document.querySelector<HTMLSelectElement>("#pass")!;
const hide = document.querySelector<HTMLButtonElement>("#hide")!;
const candidates = document.querySelector<HTMLElement>("#candidates")!;
const options = [
  { id: "rome-forum", name: "Forum City", description: "Open public courts, travertine colonnades and painted market awnings." },
  { id: "rome-aqueduct", name: "Aqueduct City", description: "Terraced brickwork, rooftop cisterns and deep service arcades." },
];
const tourByShot: Record<string, string> = {
  street: "rome-starter", district: "rome-district", crossing: "rome-district",
  skyline: "rome-skyline", dusk: "rome-district", silhouette: "rome-skyline",
};
let order = [...options];
let blind = false;

function showComparison() {
  const shot = camera.value;
  candidates.replaceChildren(...order.map((entry, index) => {
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    const caption = document.createElement("figcaption");
    const heading = document.createElement("h3");
    const label = blind ? `City ${index + 1}` : entry.name;
    image.src = photo(`${entry.id}-${shot}`);
    image.alt = `${label} · ${camera.selectedOptions[0].text}`;
    heading.textContent = label;
    caption.append(heading);
    if (!blind) {
      const description = document.createElement("p");
      description.textContent = entry.description;
      const link = document.createElement("a");
      link.textContent = "Open this island";
      link.href = `./#world=${tourByShot[shot]}&era=${entry.id}&view=${shot === "crossing" ? 1 : 0}`;
      caption.append(description, link);
    }
    figure.append(image, caption);
    return figure;
  }));
  const baseline = photo(`original-${shot}`);
  document.querySelector<HTMLElement>("#baseline")!.hidden = !baseline;
  if (baseline) document.querySelector<HTMLImageElement>("#original")!.src = baseline;
}

function showRevision() {
  document.querySelector<HTMLImageElement>("#plate")!.src = photo(`pass-${pass.value}`);
}

hide.onclick = () => {
  blind = !blind;
  if (blind) {
    order = [...options];
    if (crypto.getRandomValues(new Uint8Array(1))[0] % 2) order.reverse();
  }
  hide.setAttribute("aria-pressed", String(blind));
  hide.textContent = blind ? "Reveal names" : "Hide names";
  showComparison();
};
camera.onchange = showComparison;
pass.onchange = showRevision;
document.querySelector<HTMLImageElement>("#events")!.src = photo("events");
document.querySelector<HTMLAnchorElement>("#event-detail")!.href = photo("events");
showComparison();
showRevision();

if (new URLSearchParams(location.search).has("study")) {
  document.title = "City recognition exercise · Pixel Civilization";
  const heading = document.createElement("h1");
  heading.textContent = "Which cities do you recognize?";
  const instructions = document.createElement("p");
  instructions.textContent = "For each picture, write down the time period you see. Point out any home, market, utility, transit station or landmark you can recognize. Select a picture for a full-size look.";
  const gallery = document.createElement("div");
  gallery.className = "pair";
  const key = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Reveal the answer key";
  const answers = document.createElement("ol");
  answers.type = "A";
  for (const [label, {era, view}] of Object.entries(reviewKey)) {
    const figure = document.createElement("figure");
    const zoom = document.createElement("a");
    const img = document.createElement("img");
    img.src = zoom.href = photo(`${era}-${view}`);
    img.alt = `Picture ${label}, ${view} view`;
    const caption = document.createElement("figcaption");
    caption.textContent = `Picture ${label}`;
    zoom.append(img);
    figure.append(zoom, caption);
    gallery.append(figure);
    const answer = document.createElement("li");
    answer.textContent = era === "original" ? "Original" : "Ancient Rome · " + options.find(option => option.id === era)?.name;
    answers.append(answer);
  }
  key.append(summary, answers);
  document.querySelector("main")!.replaceChildren(heading, instructions, gallery, key);
}
