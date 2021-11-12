import { Caption, CUE_STATE, PLC } from "./Caption";
import {
  DependencyList,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { format, useKeyboard } from "./Util";
import EventEmitter from "events";

export const useCueProcessor = (
  cueState: CUE_STATE,
  caption: Caption
): [EventEmitter, string[]] => {
  const cueEvents = useMemo(() => new EventEmitter(), []);
  const useCueEvents: (
    eventName: string | symbol,
    eventHandler: (...args: any[]) => void,
    deps: DependencyList
  ) => void = (eventName, eventHandler, deps) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handler = useCallback(eventHandler, [eventHandler, ...deps]);
    useEffect(() => {
      if (!cueEvents) return;
      cueEvents.on(eventName, handler);
      return (): void => {
        void cueEvents.off(eventName, handler);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cueEvents, handler, eventName, ...deps]);
  };

  const [undoIndex, setUndoIndex] = useState<number>();
  const [currentUndoIndex, setCurrentUndoIndex] = useState<number>();
  const [startCaption, setStartCaption] = useState<Caption>(caption);
  const [lastOutTime, setLastOutTime] = useState<number>(0);

  const [currentCaption, setCurrentCaption] = useState<Caption>(caption);
  useEffect(() => {
    if (!currentCaption) return;
    console.log("(cue proc) new current caption is", currentCaption?.text);
  }, [currentCaption]);

  useCueEvents(
    "withCurrentCaption",
    (name: string, ...args) => {
      if (!currentCaption) return;
      cueEvents.emit("forEventBus", name, ...args, currentCaption);
    },
    [currentCaption]
  );

  useEffect(() => {
    if (!undoIndex) return;
    console.log("undo index now", undoIndex);
  }, [undoIndex]);

  useCueEvents("currentUndoIndex", setCurrentUndoIndex, []);
  useCueEvents("saveUndoIndex", setUndoIndex, []);

  useCueEvents(
    "cueStart",
    () => {
      setStartCaption(caption);
      cueEvents.emit("setPlayLoopCue", PLC.CUE);
      cueEvents.emit("setCueState", CUE_STATE.CUE_START);
      console.log("(cue) (start) emit set selected caption", caption.index);
      cueEvents.emit("forEventBus", "setSelectedCaption", {
        caption,
        gapDirection: "exact",
      });
      cueEvents.emit("forEventBus", "jumpToCaption", caption);
      cueEvents.emit("forEventBus", "withCurrentUndoIndex", "saveUndoIndex");
      console.log("CUE START EVENT TOGGLE");
      cueEvents.emit("forEventBus", "togglePlay", true);
      cueEvents.emit("setCueState", CUE_STATE.CUE_IN);
    },
    [cueEvents, caption]
  );

  useCueEvents(
    "cueRedo",
    () => {
      if (cueState !== CUE_STATE.CUE_IN) return;
      console.log("CUE RESTART");
      cueEvents.emit("setPlayLoopCue", PLC.CUE);
      cueEvents.emit("setCueState", CUE_STATE.CUE_IN);
      if (typeof currentUndoIndex === "number")
        cueEvents.emit("forEventBus", "setUndoIndex", currentUndoIndex - 1);
      setCurrentCaption(caption);
      cueEvents.emit("forEventBus", "setSelectedCaption", {
        caption: currentCaption,
        gapDirection: "exact",
      });
      cueEvents.emit("forEventBus", "jumpToCaption", caption);
      cueEvents.emit("forEventBus", "togglePlay", true);
    },
    []
  );

  useCueEvents(
    "time",
    (time) =>
      cueState === CUE_STATE.CUE_IN
        ? cueEvents.emit(
            "setStateMessage",
            `Caption Length: ${format(time - caption.start)}`
          )
        : cueState === CUE_STATE.CUE_GAP
        ? cueEvents.emit(
            "setStateMessage",
            `Gap Length: ${format(time - lastOutTime)}`
          )
        : void 0,
    [cueState, lastOutTime]
  );

  useCueEvents(
    "cueRestart",
    () => {
      if (cueState === CUE_STATE.CUE_IN || cueState === CUE_STATE.CUE_GAP) {
        console.log("CUE RESTART");
        cueEvents.emit("setPlayLoopCue", PLC.CUE);
        cueEvents.emit("setCueState", CUE_STATE.CUE_START);
        cueEvents.emit("forEventBus", "setUndoIndex", undoIndex);
        cueEvents.emit("forEventBus", "jumpToCaption", startCaption);
        cueEvents.emit("forEventBus", "togglePlay", true);
        setCurrentCaption(startCaption);
        cueEvents.emit("forEventBus", "setSelectedCaption", {
          caption: startCaption,
          gapDirection: "exact",
        });
        cueEvents.emit("setCueState", CUE_STATE.CUE_IN);
        cueEvents.emit("forEventBus", "withTime", "setSelectedTime");
      }
    },
    [cueState, caption]
  );

  useCueEvents(
    "cueOut",
    () => {
      if (cueState === CUE_STATE.CUE_IN) {
        console.log("CUE OUT IN SET END");
        cueEvents.emit("setCueState", CUE_STATE.CUE_GAP);
        cueEvents.emit(
          "forEventBus",
          "withTime",
          "newEndFor",
          "human cue out in",
          caption
        );
        cueEvents.emit("forEventBus", "withTime", "setLastOutTime");
        cueEvents.emit("forEventBus", "setSelectedCaption", {
          caption: caption.nextCaption,
          gapDirection: "before",
        });
      }
    },
    [cueState, caption]
  );

  useCueEvents(
    "cueIn",
    () => {
      console.log("CUE IN");
      if (cueState === CUE_STATE.CUE_IN) {
        console.log("CUE IN WHILE IN CPATION SET END");
        cueEvents.emit(
          "forEventBus",
          "withTime",
          "newEndFor",
          "human cue in out",
          caption
        );
      }
      if (caption.nextCaption) {
        cueEvents.emit(
          "forEventBus",
          "withTime",
          "newStartFor",
          "human cue in in",
          caption.nextCaption
        );
        cueEvents.emit("moveTo", { abs: caption.nextCaption.index });
      } else {
        cueEvents.emit(
          "forEventBus",
          "withTime",
          "insertAfter",
          "human cue in at end, insert",
          caption
        );
      }
      cueEvents.emit("forEventBus", "moveTo", caption.nextCaption?.index);
      if (caption.nextCaption) {
        setCurrentCaption(caption.nextCaption);
        cueEvents.emit("forEventBus", "setSelectedCaption", {
          caption: caption.nextCaption,
          gapDirection: "exact",
        });
      }
    },
    [cueEvents, caption]
  );

  useCueEvents(
    "cueSave",
    () => {
      console.log("CUE SAVE EVENT");
      cueEvents.emit("setPlayLoopCue", PLC.PAUSE);
      cueEvents.emit("setCueState", CUE_STATE.CUE_OFF);
      cueEvents.emit("forEventBus", "setSelectedTime", caption.start);
      cueEvents.emit("forEventBus", "jumpToCaption", caption);
      cueEvents.emit("forEventBus", "togglePlay", false);
    },
    [caption]
  );

  useCueEvents(
    "cueCancel",
    () => {
      console.log("CUE CANCEL EVENT");
      cueEvents.emit("forEventBus", "togglePlay", false);
      cueEvents.emit("forEventBus", "setCurrentUndoIndex", undoIndex);
      cueEvents.emit("forEventBus", "withTime", "setSelectedTime");
      cueEvents.emit("setPlayLoopCue", PLC.PAUSE);
      cueEvents.emit("setCueState", CUE_STATE.CUE_OFF);
    },
    [cueEvents]
  );

  useCueEvents("setLastOutTime", setLastOutTime, []);
  useCueEvents(
    "setLastOutTime",
    (...args) => console.log("setting last out time", args),
    []
  );

  useKeyboard("editEscape", () => console.log("AIWIIEEEE"), []);
  useKeyboard("editEscape", () => cueEvents.emit("cueCancel"), []);
  useKeyboard("editEnter", () => cueEvents.emit("cueSave"), []);
  useKeyboard("editSpace", () => cueEvents.emit("cueIn"), []);
  useKeyboard("editBackspace", () => cueEvents.emit("cueOut"), []);
  useKeyboard("editPageUp", () => cueEvents.emit("cueRestart"), []);
  useKeyboard("editDelete", () => cueEvents.emit("cueRedo"), []);

  const subscribeTo = useMemo(
    () => [
      "time",
      "setLastOutTime",
      "cueIn",
      "cueOut",
      "cueCancel",
      "cueRedo",
      "cueRestart",
      "saveUndoIndex",
      "withCurrentCaption",
    ],
    []
  );

  return [cueEvents, subscribeTo];
};
