import { Caption, CUE_STATE, PLC } from "./Caption";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { EditContext } from "./Transcript";
import { format, useClock } from "./Util";
import { emitter } from "./EditBox";

export const useCueProcessor = (
  cueState: CUE_STATE,
  setCueState: Dispatch<SetStateAction<CUE_STATE>>,
  setPlayLoopCue: Dispatch<SetStateAction<PLC>>,
  setStateMessage: Dispatch<SetStateAction<string | undefined>>,
  caption: Caption,
  next?: Caption,
  prev?: Caption
) => {
  const { clock } = useContext(EditContext);
  const [playCurrentTime, setTime] = useState<number>(0);

  useClock(
    "cueStart",
    () => {
      setPlayLoopCue(PLC.CUE);
      setCueState(CUE_STATE.CUE_START);
      emitter(clock, "jumpToCaption", caption);
      emitter(clock, "saveNewUndoPoint");
      emitter(clock, "togglePlay", true);
      setCueState(CUE_STATE.CUE_IN);
    },
    [setPlayLoopCue, setCueState, clock]
  );
  useClock(
    "cueCancel",
    () => {
      emitter(clock, "togglePlay", false);
      setCueState(CUE_STATE.CUE_OFF);
      setPlayLoopCue(PLC.PAUSE);
    },
    [setPlayLoopCue, setCueState, clock]
  );

  const updateInLength = useCallback(
    (time) => {
      if (!caption?.start) return;
      setStateMessage(`Caption Length: ${format(time - caption.start)}`);
    },
    [caption?.start, setStateMessage]
  );
  const [lastOutTime, setLastOutTime] = useState<number>(0);
  const updateOutLength = useCallback(
    (time) => {
      if (!caption?.end) return;
      setStateMessage(`Gap Length: ${format(time - lastOutTime)}`);
    },
    [caption?.end, lastOutTime, setStateMessage]
  );
  useEffect(() => {
    if (!clock) return;
    const cleanup: (() => void)[] = [];
    switch (cueState) {
      case CUE_STATE.CUE_OFF:
        break;
      case CUE_STATE.CUE_START:
        emitter(clock, "jumpToCaption", caption);
        emitter(clock, "saveNewUndoPoint");
        emitter(clock, "togglePlay", true);
        setCueState(CUE_STATE.CUE_GAP);
        break;

      // while in cue_gap when cueIn, send newStartFor next
      case CUE_STATE.CUE_GAP:
        clock.on("time", setTime);
        const onAction = () => {
          if (caption.nextCaption) {
            emitter(clock, "newStartFor", {
              note: "human cue out",
              caption: next,
              time: playCurrentTime,
            });
          }
        };
        clock.on("cueIn", onAction);
        clock.on("time", updateInLength);
        cleanup.push((): void => {
          clock.off("time", setTime);
          clock.off("time", updateOutLength);
          clock.off("cueIn", onAction);
        });
        //        emitter(clock, "cueOut", caption.uuid);
        break;

      // while cue in - on CueIn set start of next, set end for last
      // on cueOut, set end of current
      case CUE_STATE.CUE_IN:
        const onInInAction = () => {
          if (next)
            emitter(clock, "newStartFor", {
              note: "human cue in",
              caption: next,
              time: playCurrentTime + 0.001,
            });
          emitter(clock, "newEndFor", {
            note: "human cue in",
            caption,
            time: playCurrentTime,
          });
        };
        const onInOutAction = () => {
          setLastOutTime(playCurrentTime);
          emitter(clock, "newEndFor", {
            note: "human cue in",
            caption,
            time: playCurrentTime,
          });
          setCueState(CUE_STATE.CUE_GAP);
        };
        clock.on("time", setTime);
        clock.on("cueIn", onInInAction);
        clock.on("cueOut", onInOutAction);
        clock.on("time", updateInLength);
        cleanup.push((): void => {
          clock.off("time", setTime);
          clock.off("time", updateInLength);
          clock.off("cueIn", onInInAction);
          clock.off("cueOut", onInOutAction);
        });
        break;

      case CUE_STATE.CUE_CANCEL:
        break;
      case CUE_STATE.CUE_SAVE:
        emitter(clock, "playLoopCue", "pause");
        emitter(clock, "restoreToUndoPoint");
        emitter(clock, "togglePlay", false);
        setPlayLoopCue(PLC.PAUSE);
        setCueState(CUE_STATE.CUE_OFF);
    }
    if (cleanup.length) {
      return (): void => cleanup.forEach((cb) => cb());
    }
  }, [
    setCueState,
    setPlayLoopCue,
    cueState,
    clock,
    caption,
    next,
    prev,
    updateInLength,
    updateOutLength,
    lastOutTime,
    playCurrentTime,
  ]);
};
