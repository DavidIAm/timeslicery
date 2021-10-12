import { Caption, CUE_STATE, PLC } from "./Caption";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EditContext } from "./Transcript";
import { format, useClock } from "./Util";
import EventEmitter from "events";

export const useCueProcessor = (
  cueState: CUE_STATE,
  caption: Caption,
  next?: Caption,
  prev?: Caption
): [EventEmitter, string[]] => {
  const cueEvents = useMemo(() => new EventEmitter(), []);
  const { clock } = useContext(EditContext);
  const [undoIndex, setUndoIndex] = useState<number>();

  useClock("saveUndoIndex", setUndoIndex, []);
  useEffect(() => console.log("undo index now", undoIndex), [undoIndex]);
  useClock(
    "cueStart",
    () => {
      cueEvents.emit("setPlayLoopCue", PLC.CUE);
      cueEvents.emit("setCueState", CUE_STATE.CUE_START);
      cueEvents.emit("forEventBus", "jumpToCaption", caption);
      cueEvents.emit("forEventBus", "withCurrentUndoIndex", "saveUndoIndex");
      cueEvents.emit("forEventBus", "togglePlay", true);
      cueEvents.emit("setCueState", CUE_STATE.CUE_IN);
    },
    [cueEvents, clock]
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
      cueEvents.emit("forEventBus", "togglePlay", false);
      if (undoIndex)
        cueEvents.emit("forEventBus", "setCurrentUndoIndex", undoIndex);
      cueEvents.emit("setCueState", CUE_STATE.CUE_OFF);
      cueEvents.emit("setPlayLoopCue", PLC.PAUSE);
    },
    [cueEvents, clock]
  );

  const updateInLength = useCallback(
    (time) => {
      if (!caption?.start) return;
      cueEvents.emit(
        "setStateMessage",
        `Caption Length: ${format(time - caption.start)}`
      );
    },
    [caption?.start, cueEvents]
  );
  const [lastOutTime, setLastOutTime] = useState<number>(0);
  const updateOutLength = useCallback(
    (time) => {
      if (!caption?.end) return;
      cueEvents.emit(
        "setStateMessage",
        `Gap Length: ${format(time - lastOutTime)}`
      );
    },
    [caption?.end, lastOutTime, cueEvents]
  );
  useEffect(() => {
    if (!clock) return;
    const cleanup: (() => void)[] = [];
    switch (cueState) {
      case CUE_STATE.CUE_OFF:
        break;
      case CUE_STATE.CUE_START:
        cueEvents.emit("forEventBus", "jumpToCaption", caption);
        cueEvents.emit("forEventBus", "saveNewUndoPoint");
        cueEvents.emit("forEventBus", "togglePlay", true);
        cueEvents.emit("setCueState", CUE_STATE.CUE_GAP);
        break;

      // while in cue_gap when cueIn, send newStartFor next
      case CUE_STATE.CUE_GAP:
        const onAction = () => {
          if (caption.nextCaption)
            cueEvents.emit(
              "forEventBus",
              "withTime",
              "newStartFor",
              "human cue out",
              next
            );
        };
        clock.on("cueIn", onAction);
        clock.on("time", updateOutLength);
        cleanup.push((): void => {
          clock.off("cueIn", onAction);
          clock.off("time", updateOutLength);
        });
        //        cueEvents.emit("forEventBus", "cueOut", caption.uuid);
        break;

      // while cue in - on CueIn set start of next, set end for last
      // on cueOut, set end of current
      case CUE_STATE.CUE_IN:
        const onInInAction = () => {
          if (next) {
            cueEvents.emit(
              "forEventBus",
              "withTime",
              "newStartFor",
              "human cue in",
              next
            );
          }
          cueEvents.emit(
            "forEventBus",
            "withTime",
            "newEndFor",
            "human cue in",
            caption
          );
          cueEvents.emit("forEventBus", "moveTo", next);
        };
        const onInOutAction = () => {
          cueEvents.emit("forEventBus", "withTime", "setLastOutTime");
          cueEvents.emit(
            "forEventBus",
            "withTime",
            "newEndFor",
            "human cue in",
            caption
          );
          cueEvents.emit("setCueState", CUE_STATE.CUE_GAP);
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
        cueEvents.emit("setCueState", CUE_STATE.CUE_OFF);
        cueEvents.emit("setPlayLoopCue", PLC.PAUSE);
        cueEvents.emit("forEventBus", "restoreToUndoPoint", undoIndex);
        cueEvents.emit("forEventBus", "togglePlay", false);
    }
    if (cleanup.length) {
      return (): void => cleanup.forEach((cb) => cb());
    }
  }, [
    cueEvents,
    cueState,
    clock,
    caption,
    next,
    prev,
    updateInLength,
    updateOutLength,
    lastOutTime,
    undoIndex,
  ]);

  const subscribeTo = useMemo(
    () => ["cueIn", "time", "setLastOutTime", "cueIn", "cueOut", "time"],
    []
  );

  return [cueEvents, subscribeTo];
};
