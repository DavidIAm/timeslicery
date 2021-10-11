import React, {
  Reducer,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { Caption, CUE_STATE } from "./Caption";
import { EditContext } from "./Transcript";
import { LineSet } from "./LineSet";
import { EditBox } from "./EditBox";
import EventEmitter from "events";
import { useClock } from "./Util";

export type LinesProps = {
  captions: Caption[];
};

const offsets: {
  alt: boolean;
  shift: boolean;
  offset?: number;
  captions?: number;
}[] = [
  { alt: false, shift: false, offset: 1 },
  { alt: false, shift: true, offset: 30 },
  { alt: true, shift: false, offset: 150 },
  { alt: true, shift: true, offset: 750 },
];
const offset: (e: KeyboardEvent) => number = ({ altKey, shiftKey }) =>
  offsets.find(({ alt, shift }) => alt === altKey && shift === shiftKey)
    ?.offset || 0;

type ChangePositionType = (e: { rel?: number; abs?: number }) => void;
type JumpTupleType = [
  Caption[],
  EventEmitter,
  number,
  ChangePositionType,
  "prevCaption" | "nextCaption"
];

export function up(event: KeyboardEvent, ...args: JumpTupleType): void {
  return jump(-1 * offset(event), ...args);
}

export function down(event: KeyboardEvent, ...args: JumpTupleType): void {
  return jump(offset(event), ...args);
}

export function jump(
  offset: number,
  all: Caption[],
  clock: EventEmitter,
  position: number,
  changePosition: (e: { rel?: number; abs?: number }) => void,
  captionDirection: "prevCaption" | "nextCaption"
) {
  const current = all[Math.max(Math.floor(position), 0)] || 0;
  if (Math.abs(offset) === 1) {
    if (current[captionDirection])
      return changePosition({ abs: current[captionDirection]?.index });
    return;
  }
  const newTime = Math.max(current.start + offset);
  const newIndex =
    positionOf(all, newTime) || (offset > 0 ? all.length - 1 : 0);
  console.log({ position, currentTime: current.start, newTime, newIndex });
  changePosition({ abs: newIndex });
}

//A -0.5          ^ |<*>
//B    0        ^ <-|-> <*>
//C  0.5    ... <-->| <*>
//D    n      ... <-|-> $
//E  n.5    ... <-->| $
const positionOf = (captions: Caption[], thisTimepoint: number) => {
  const oneAfter = captions.find(({ start }) => thisTimepoint < start);
  // A B C
  if (oneAfter) {
    // B C
    if (oneAfter.prevCaption) {
      // B
      if (thisTimepoint < oneAfter.prevCaption.end) {
        return oneAfter.prevCaption.index;
      } else {
        // C
        return (oneAfter.prevCaption.index || 0) + 0.5;
      }
    } else {
      // A
      return -0.5;
    }
  } else {
    // D E
    const caption = captions[captions.length - 1];
    // E
    if (thisTimepoint > caption.end) {
      return (caption.index || 0) + 0.5;
    } else {
      // D
      return caption.index;
    }
  }
};

export const Lines: React.FC<LinesProps> = ({ captions }) => {
  const { keyboard, clock } = useContext(EditContext);
  const [captionBlock, setCaptionBlock] = useState<HTMLDivElement | null>();
  const [cueState, setCueState] = useState<CUE_STATE>(CUE_STATE.CUE_OFF);
  const [{ top, bottom }, setWindow] = useState<{
    top: number;
    bottom: number;
  }>(() => ({ top: 0, bottom: 5 }));

  useClock("cueState", setCueState, []);

  const voiceSet = useMemo(
    () => new Set(captions.map((c) => c.voice)),
    [captions]
  );
  useEffect(() => {
    clock.emit("voiceSet", voiceSet);
  }, [clock, voiceSet]);

  useEffect(() => {
    if (!captionBlock) return;
    const docFocus = () => clock.emit("blurPause", false);
    const docBlur = () => clock.emit("blurPause", true);
    //const stop = (event: KeyboardEvent) => event.stopPropagation();
    const emit = (event: KeyboardEvent) => {
      const { code } = event;
      keyboard.emit("keyboard", { zone: "lines", event });
      keyboard.emit(`lines${code}`, event);
      console.log(event);
      event.stopPropagation();
    };
    window.addEventListener("focus", docFocus);
    window.addEventListener("blur", docBlur);
    captionBlock.addEventListener("keyup", emit);
    return (): void => {
      captionBlock.removeEventListener("keyup", emit);
      window.removeEventListener("focus", docFocus);
      window.removeEventListener("blur", docBlur);
    };
  }, [keyboard, captionBlock, clock]);

  const positionReducer = useCallback<
    Reducer<number, { abs?: number; rel?: number }>
  >((state, { abs, rel }) => {
    if (rel) return state + rel;
    else if (typeof abs !== "undefined") return abs;
    return -1;
  }, []);

  const [position, changePosition] = useReducer(positionReducer, -1, (t) => t);

  const play = useCallback<(e: KeyboardEvent) => void>(
    () => void clock.emit("togglePlay"),
    [clock]
  );

  useClock(
    "moveTo",
    (caption: Caption) => changePosition({ abs: caption!.index }),
    []
  );

  useEffect(() => {
    const moveDown = (event: KeyboardEvent) =>
      down(event, captions, clock, position, changePosition, "nextCaption");
    const moveUp = (event: KeyboardEvent) =>
      up(event, captions, clock, position, changePosition, "prevCaption");
    clock.on("moveDown", moveDown).on("moveUp", moveUp);
    keyboard
      .on("linesKeyJ", moveDown)
      .on("linesKeyK", moveUp)
      .on("linesSpace", play);
    return () => {
      clock.off("moveDown", moveDown).off("moveUp", moveUp);
      keyboard
        .off("linesKeyJ", moveDown)
        .off("linesKeyK", moveUp)
        .off("linesSpace", play);
    };
  }, [keyboard, clock, position, captions, play]);

  useEffect(() => {
    if (position < 0 || !captions[Math.floor(position)]) return;
    clock.emit("jumpToCaption", captions[position]);
    const top = Math.max(Math.floor(position) - 2, 0);
    setWindow({
      top,
      bottom: Math.min(top + 5, captions.length),
    });
  }, [position, captions.length, captions, clock]);

  useEffect(() => {
    if (!clock) return;
    if (!captions) return;
    if (!captions.length) return;
    const timeListener = (currentTime: number): void => {
      const current = captions[Math.max(Math.floor(position), 0)];
      if (currentTime >= current.start && currentTime < current.end) {
        if (current.index === position) return;
        changePosition({ abs: current.index });
      }
      const next = current.nextCaption;
      if (next && currentTime >= next.start && currentTime < next.end)
        return changePosition({ abs: next.index });
      if (next && currentTime < next.start && currentTime > current.end)
        return changePosition({ abs: (current.index || 0) + 0.5 });
      changePosition({
        abs: positionOf(captions, currentTime),
      });
    };
    if (cueState === CUE_STATE.CUE_OFF) {
      clock.on("time", timeListener);
      return (): void => {
        clock.off("time", timeListener);
      };
    }
  }, [clock, captions, position, cueState]);

  return (
    <>
      <EditBox
        caption={captions[Math.min(Math.max(position, 0), captions.length - 1)]}
        prev={position ? captions[position - 1] : void 0}
        next={position + 2 < captions.length ? captions[position + 1] : void 0}
      />
      <div
        tabIndex={1}
        onMouseEnter={({ currentTarget }) => currentTarget.focus()}
        ref={setCaptionBlock}
        id={"captionBlock"}
      >
        <LineSet top={top} position={position} bottom={bottom} set={captions} />
      </div>
    </>
  );
};
