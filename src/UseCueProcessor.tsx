import { Caption, CUE_STATE, PLC } from "./Caption";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, useClock } from "./Util";
import EventEmitter from "events";

export const useCueProcessor = (
  cueState: CUE_STATE,
  caption: Caption,
  next?: Caption,
  prev?: Caption
): [EventEmitter, string[]] => {
  const cueEvents = useMemo(() => new EventEmitter(), []);
  const [undoIndex, setUndoIndex] = useState<number>();

  useEffect(() => console.log("undo index now", undoIndex), [undoIndex]);

  useEffect(() => {
    cueEvents.on("saveUndoIndex", setUndoIndex);
    return (): void => void cueEvents.off("saveUndoIndex", setUndoIndex);
  }, [cueEvents]);

  useClock(
    "cueStart",
    () => {
      cueEvents.emit("setPlayLoopCue", PLC.CUE);
      cueEvents.emit("setCueState", CUE_STATE.CUE_START);
      cueEvents.emit("forEventBus", "setSelectedTime", caption.start);
      cueEvents.emit("forEventBus", "jumpToCaption", caption);
      cueEvents.emit("forEventBus", "withCurrentUndoIndex", "saveUndoIndex");
      console.log("CUE START EVENT TOGGLE");
      cueEvents.emit("forEventBus", "togglePlay", true);
      cueEvents.emit("setCueState", CUE_STATE.CUE_IN);
    },
    [cueEvents]
  );

  useClock(
    "cueIn",
    () => {
      // are we cueing?
      // If so, end the current one
      // regardless, start the next one
      const onInInAction = () => {
        if (next) {
          cueEvents.emit(
            "forEventBus",
            "withTime",
            "newStartFor",
            "human cue in in with next",
            next
          );
          cueEvents.emit("forEventBus", "setSelectedTime", next?.start);
        }
        cueEvents.emit(
          "forEventBus",
          "withTime",
          "newEndFor",
          "human cue in in",
          caption
        );
        cueEvents.emit("forEventBus", "moveTo", next?.index);
      };
      const onInOutAction = () => {
        cueEvents.emit("forEventBus", "withTime", "setLastOutTime");
        cueEvents.emit(
          "forEventBus",
          "withTime",
          "newEndFor",
          "human cue in out",
          caption
        );
        cueEvents.emit("setCueState", CUE_STATE.CUE_GAP);
      };
      cueEvents.on("setLastOutTime", setLastOutTime);
      cueEvents.on("cueIn", onInInAction);
      cueEvents.on("cueOut", onInOutAction);
      cueEvents.on("time", updateInLength);
      return (): void => {
        cueEvents.off("setLastOutTime", setLastOutTime);
        cueEvents.off("time", updateInLength);
        cueEvents.off("cueIn", onInInAction);
        cueEvents.off("cueOut", onInOutAction);
      };
    },
    [cueEvents]
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
      console.log("CANCEL EVENT TOGGLE");
      cueEvents.emit("forEventBus", "togglePlay", false);
      if (undoIndex)
        cueEvents.emit("forEventBus", "setCurrentUndoIndex", undoIndex);
      else console.warn("cancel no events", undoIndex);
      cueEvents.emit("setCueState", CUE_STATE.CUE_OFF);
      cueEvents.emit("setPlayLoopCue", PLC.PAUSE);
    },
    [cueEvents]
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
    cueEvents.emit("cueState", cueState);
    const cleanup: (() => void)[] = [];
    switch (cueState) {
      case CUE_STATE.CUE_OFF:
        break;
      case CUE_STATE.CUE_START:
        cueEvents.emit("forEventBus", "jumpToCaption", caption);
        console.log("Setting selected time");
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
        cueEvents.emit("forEventBus", "setSelectedTime", caption.end);
        cueEvents.on("cueIn", onAction);
        cueEvents.on("time", updateOutLength);
        cleanup.push((): void => {
          cueEvents.off("cueIn", onAction);
          cueEvents.off("time", updateOutLength);
        });
        //        cueEvents.emit("forEventBus", "cueOut", caption.uuid);
        break;

      // while cue in - on CueIn set start of next, set end for last
      // on cueOut, set end of current
      case CUE_STATE.CUE_IN:
        break;

      case CUE_STATE.CUE_CANCEL:
        break;
      case CUE_STATE.CUE_SAVE:
        cueEvents.emit("setCueState", CUE_STATE.CUE_OFF);
        cueEvents.emit("setPlayLoopCue", PLC.PAUSE);
        cueEvents.emit("forEventBus", "restoreToUndoPoint", undoIndex);
        console.log("CUE SAVE MODE TOGGLE");
        cueEvents.emit("forEventBus", "togglePlay", false);
    }
    if (cleanup.length) {
      return (): void => cleanup.forEach((cb) => cb());
    }
  }, [
    cueEvents,
    cueState,
    caption,
    next,
    prev,
    updateInLength,
    updateOutLength,
    lastOutTime,
    undoIndex,
  ]);

  const subscribeTo = useMemo(
    () => [
      "time",
      "setLastOutTime",
      "cueIn",
      "cueOut",
      "time",
      "saveUndoIndex",
    ],
    []
  );

  return [cueEvents, subscribeTo];
};
