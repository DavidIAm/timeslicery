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

export function up(
  event: KeyboardEvent,
  all: Caption[],
  clock: EventEmitter,
  position: number,
  changePosition: (e: { rel?: number; abs?: number }) => void
) {
  const seekPoint = Math.max(
    Math.min(
      (all[Math.max(position, 0)]?.start || 0) - offset(event),
      all[Math.max(position, 1) - 1]?.start
    ),
    0
  );
  const caption =
    all
      .slice(0, Math.max(position + 1, 0))
      .reverse()
      .find(
        (c, i, a) =>
          c.start <= seekPoint && a[Math.max(i - 1, 0)]?.start > seekPoint
      ) || all.find(() => true);
  if (!caption) console.warn("no captions available?");
  if (!caption) return;
  changePosition({ abs: caption.index });
  clock.emit("jumpToCaption", caption);
}

export function down(
  event: KeyboardEvent,
  all: Caption[],
  clock: EventEmitter,
  position: number,
  changePosition: (e: { rel?: number; abs?: number }) => void
) {
  const seekPoint = Math.min(
    Math.max(
      (all[Math.max(position, 0)]?.start || 0) + offset(event),
      all[Math.min(Math.max(position, 0) + 1, all.length)]?.start
    ),
    all[all.length - 1].end
  );
  const caption =
    all.slice(Math.max(position, 0)).find((c, i, a) => {
      return a[i]?.start <= seekPoint && a[i + 1]?.start > seekPoint;
    }) || all[all.length - 1];
  if (!caption) console.warn("no captions available?");
  if (!caption) return;
  changePosition({ abs: caption.index });
  clock.emit("jumpToCaption", caption);
}

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

  useEffect(() => {
    const moveDown = (event: KeyboardEvent) =>
      down(event, captions, clock, position, changePosition);
    const moveUp = (event: KeyboardEvent) =>
      up(event, captions, clock, position, changePosition);
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
    if (position < 0 || !captions[position]) return;
    clock.emit("jumpToCaption", captions[position]);
    const top = Math.max(position - 2, 0);
    setWindow({
      top,
      bottom: Math.min(top + 5, captions.length),
    });
  }, [position, captions.length, captions, clock]);

  useEffect(() => {
    if (!clock) return;
    if (!captions) return;
    if (!bottom) return;
    const timeListener = (currentTime: number): void => {
      const inThisCaption: (c: Caption) => boolean = ({ end, start }) =>
        currentTime < end && currentTime >= start;

      const positionOf = () => {
        if (currentTime <= (captions[0]?.end || 0)) return 0;
        const sliced = captions.slice(top, bottom).find(inThisCaption)?.index;
        if (typeof sliced === "number") return sliced;
        const scanned = captions.find(inThisCaption)?.index;
        if (typeof scanned === "number") return scanned;
        return position;
      };
      changePosition({ abs: positionOf() });
    };
    if (cueState === CUE_STATE.CUE_OFF) {
      clock.on("time", timeListener);
      return (): void => {
        clock.off("time", timeListener);
      };
    }
  }, [clock, captions, position, bottom, top, cueState]);

  return (
    <>
      <EditBox caption={captions[Math.max(position, 0)]} />
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
