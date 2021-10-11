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
  const [undoIndex, setUndoIndex] = useState<number>();

  useClock("saveUndoIndex", setUndoIndex, []);
  useEffect(() => console.log("undo index now", undoIndex), [undoIndex]);
  useClock(
    "cueStart",
    () => {
      setPlayLoopCue(PLC.CUE);
      setCueState(CUE_STATE.CUE_START);
      clock.emit("jumpToCaption", caption);
      clock.emit("withCurrentUndoIndex", "saveUndoIndex");
      clock.emit("togglePlay", true);
      setCueState(CUE_STATE.CUE_IN);
    },
    [setPlayLoopCue, setCueState, clock]
  );

  useClock(
    "cueSave",
    () => {
      console.log("cue save activated");
    },
    []
  );

  useClock(
    "cueCancel",
    () => {
      emitter(clock, "togglePlay", false);
      if (undoIndex) emitter(clock, "setCurrentUndoIndex", undoIndex);
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
        const onAction = () => {
          if (caption.nextCaption)
            clock.emit("withTime", "newStartFor", "human cue out", next);
        };
        clock.on("cueIn", onAction);
        clock.on("time", updateOutLength);
        cleanup.push((): void => {
          clock.off("cueIn", onAction);
          clock.off("time", updateOutLength);
        });
        //        emitter(clock, "cueOut", caption.uuid);
        break;

      // while cue in - on CueIn set start of next, set end for last
      // on cueOut, set end of current
      case CUE_STATE.CUE_IN:
        const onInInAction = () => {
          if (next) {
            clock.emit("withTime", "newStartFor", "human cue in", next);
          }
          clock.emit("withTime", "newEndFor", "human cue in", caption);
          clock.emit("moveTo", next);
        };
        const onInOutAction = () => {
          clock.emit("withTime", "setLastOutTime");
          clock.emit("withTime", "newEndFor", "human cue in", caption);
          setCueState(CUE_STATE.CUE_GAP);
        };
        clock.on("setLastOutTime", setLastOutTime);
        clock.on("cueIn", onInInAction);
        clock.on("cueOut", onInOutAction);
        clock.on("time", updateInLength);
        cleanup.push((): void => {
          clock.off("setLastOutTime", setLastOutTime);
          clock.off("time", updateInLength);
          clock.off("cueIn", onInInAction);
          clock.off("cueOut", onInOutAction);
        });
        break;

      case CUE_STATE.CUE_CANCEL:
        break;
      case CUE_STATE.CUE_SAVE:
        setCueState(CUE_STATE.CUE_OFF);
        setPlayLoopCue(PLC.PAUSE);
        clock.emit("restoreToUndoPoint", undoIndex);
        clock.emit("togglePlay", false);
    }
    if (cleanup.length) {
      return (): void => cleanup.forEach((cb) => cb());
    }
  }, [
    cueState,
    setCueState,
    setPlayLoopCue,
    clock,
    caption,
    next,
    prev,
    updateInLength,
    updateOutLength,
    lastOutTime,
  ]);
};
