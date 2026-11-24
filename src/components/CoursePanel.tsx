import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Play, RotateCcw } from "lucide-react";
import { ELEMENT_BY_ID } from "../game/catalog";
import { readPlayerItem, writePlayerItem } from "../game/deviceSaves";
import { applyCourseAction, COURSE, makeCourseIsland, tileAt } from "../handbook/course";
import { ElementFavicon } from "./ElementFavicon";
import "./course.css";

type Phase = "ready" | "demonstrated" | "practice" | "complete";
const STORAGE = "pixel_civ_course_checks_v1";
const coordinates = [-2,-1,0,1,2];
const progress = (): string[] => {
  try {
    const saved: unknown = JSON.parse(readPlayerItem(STORAGE) ?? "[]");
    return Array.isArray(saved) ? COURSE.map(lesson => lesson.id).filter(id => saved.includes(id)) : [];
  } catch { return []; }
};

export function CoursePanel({ lessonId, onLesson, onAtlas, onRead, onTour }: {
  lessonId?: string;
  onLesson: (id: string) => void;
  onAtlas: (id: string) => void;
  onRead: (chapter: string) => void;
  onTour?: (tour: NonNullable<(typeof COURSE)[number]["tour"]>) => void;
}) {
  const lesson = COURSE.find(item => item.id === lessonId) ?? COURSE[0];
  const index = COURSE.indexOf(lesson);
  const [completed,setCompleted] = useState(progress);
  return (
    <section className="pc-course" aria-label="Island Builder Course">
      <header className="pc-course-intro">
        <div><p className="pc-course-kicker">Pixel Civilization Handbook</p><h1>Island Builder Course</h1>
          <p>Watch a move, try it yourself, then explore the designs and take the lesson back to your island.</p></div>
        <div className="pc-course-progress"><strong>{completed.length} of {COURSE.length} complete</strong>
          <progress aria-label="Course progress" value={completed.length} max={COURSE.length} /></div>
      </header>
      <div className="pc-course-layout">
        <nav className="pc-course-outline" aria-label="Course lessons">
          {COURSE.map((item, i) => <button key={item.id} type="button" aria-current={item === lesson ? "step" : undefined}
            onClick={() => onLesson(item.id)}><span>{completed.includes(item.id) ? <Check size={15} aria-label="Complete" /> : i + 1}</span>{item.title}</button>)}
        </nav>
        <div className="pc-course-content">
          <LessonLab key={lesson.id} lesson={lesson} complete={() => {
            if (completed.includes(lesson.id)) return;
            const next = [...completed,lesson.id]; setCompleted(next);
            writePlayerItem(STORAGE,JSON.stringify(next));
          }} />
          <section aria-label="Atlas and reference links" className="pc-course-atlas">
            <h3>Explore the designs</h3>
            <div>{lesson.elements.map(id => <button key={id} type="button" onClick={() => onAtlas(id)}>
              <ElementFavicon def={ELEMENT_BY_ID[id]} /><span>{ELEMENT_BY_ID[id].name}</span><Compass aria-hidden="true" size={15} />
            </button>)}</div>
          </section>
          <div className="pc-course-actions">
            <button type="button" onClick={() => onRead(lesson.reference)}><BookOpen size={16} aria-hidden="true" /> Read the field guide</button>
            {lesson.tour && (onTour ? <button type="button" onClick={() => onTour(lesson.tour!)}><Play size={16} aria-hidden="true" />{lesson.tour.label}</button>
              : <a href="./">Open the game for island tours</a>)}
          </div>
          <div className="pc-course-actions pc-course-pager">
            <button type="button" disabled={index === 0} onClick={() => onLesson(COURSE[index - 1].id)}><ArrowLeft size={16} aria-hidden="true" /> Previous lesson</button>
            <button type="button" disabled={index === COURSE.length - 1} onClick={() => onLesson(COURSE[index + 1].id)}>Next lesson <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LessonLab({ lesson, complete }: { lesson: (typeof COURSE)[number]; complete: () => void }) {
  const [island,setIsland] = useState(() => makeCourseIsland(lesson));
  const [phase,setPhase] = useState<Phase>("ready");
  const [feedback,setFeedback] = useState("Watch the coach before taking the controls.");
  const [gx,gz] = lesson.action.at;
  const targetRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (phase === "practice") targetRef.current?.focus({preventScroll:true}); },[phase]);
  const practice = () => {
    setIsland(makeCourseIsland(lesson)); setPhase("practice");
    setFeedback("Choose the marked tile to apply " + lesson.tool + ".");
  };
  const act = (x: number,z: number,coach = false) => {
    if (!coach && (x !== gx || z !== gz)) {
      setFeedback("Use the marked tile to meet this lesson’s goal."); return;
    }
    const next = makeCourseIsland(lesson);
    const result = applyCourseAction(next,lesson.action,[x,z]);
    if (!result.ok) { setFeedback(result.detail ?? "This placement is blocked."); return; }
    setIsland(next);
    if (coach) {
      setPhase("demonstrated");
      setFeedback("The coach applied " + lesson.tool + ". Compare the marked area with the surrounding cells.");
    } else {
      setPhase("complete"); complete(); setFeedback("Goal met. Explore the designs below or continue to the next lesson.");
    }
  };
  return <>
    <figure className="pc-course-image"><img src={"./handbook/" + lesson.image} alt={lesson.alt} /><figcaption>{lesson.alt}</figcaption></figure>
    <h2>{lesson.title}</h2><p className="pc-course-goal">{lesson.goal}</p>
    <div className="pc-course-coach"><strong>Coach</strong><p>{lesson.coach}</p></div>
    <section className="pc-course-lab" aria-label="Practice island">
      <div><h3>Practice island</h3><p>Changes here stay in this exercise. Your saved worlds are separate.</p>
        <div className="pc-course-actions">
          <button type="button" onClick={() => act(gx,gz,true)}><Play aria-hidden="true" size={16} /> Show me</button>
          <button type="button" onClick={practice}>{phase === "complete" ? <><RotateCcw aria-hidden="true" size={16} /> Try again</> : "Let me try"}</button>
        </div><p className="pc-course-feedback" role="status">{feedback}</p>
      </div>
      <div className="pc-course-board" role="group" aria-label="Five by five practice map">
        {coordinates.flatMap(z => coordinates.map(x => {
          const {cell,placed} = tileAt(island,x,z);
          const target = x === gx && z === gz;
          const label = placed ? ELEMENT_BY_ID[placed.defId].name : cell.water !== "dry" ? "Water" : "Land";
          return <button key={x + "," + z} ref={target ? targetRef : undefined} type="button"
            aria-label={(target ? "Marked tile, " : "") + label + ", column " + (x + 3) + ", row " + (z + 3)}
            disabled={phase !== "practice"} data-target={target} data-water={cell.water !== "dry"}
            style={{"--ground-light": Math.min(87,Math.max(34,45 + cell.elevation * 9)) + "%"} as React.CSSProperties}
            onClick={() => act(x,z)}>
            {placed ? <ElementFavicon def={ELEMENT_BY_ID[placed.defId]} /> : target ? <span aria-hidden="true">•</span> : null}
          </button>;
        }))}
      </div>
    </section>
  </>;
}
