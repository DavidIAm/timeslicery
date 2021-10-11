import { Caption, PLC } from "./Caption";
import { useCallback, useContext, useEffect } from "react";
import { EditContext } from "./Transcript";

export const useCutProcessor = (
  playLoopCue: PLC,
  caption: Caption,
  next?: Caption,
  prev?: Caption
) => {
  const { clock } = useContext(EditContext);
  const cutPrev = useCallback(() => {
    clock.once("time", (time) => {
      clock.emit("newEndFor", {
        caption: prev,
        time,
        note: "cut to prev - end of prev",
      });
      clock.emit("newStartFor", {
        caption,
        time: time + 0.001,
        note: "cut to prev - start of current",
      });
    });
  }, [clock, prev, caption]);

  const withTime = useCallback(
    (...args) => clock.emit("withTime", args),
    [clock]
  );
  const cutNext = useCallback(
    (time: number) => {
      console.log("Activate CutNext");
      clock.emit("newEndFor", {
        caption,
        time,
        note: "cut to next - end of current",
      });
      clock.emit("newStartFor", {
        caption: next,
        time: time + 0.001,
        note: "cut to next - start of next",
      });
    },
    [clock, caption, next]
  );
  useEffect(() => {
    switch (playLoopCue) {
      case PLC.PAUSE:
        break;
      case PLC.PLAY:
      case PLC.ENTRY:
      case PLC.CUE:
        console.log("Cut Enabled");
        clock.on("cutToPrev", cutPrev);
        clock.on("cutToNext", cutNext);
        return (): void => {
          clock.off("cutToPrev", cutPrev);
          clock.off("cutToNext", cutNext);
        };
    }
  }, [clock, cutPrev, cutNext, playLoopCue]);
  useEffect(() => console.log("clock"), [clock]);
  useEffect(() => console.log("cutPrev"), [cutPrev]);
  useEffect(() => console.log("cutNext"), [cutNext]);
  useEffect(() => console.log("playLoopCue"), [playLoopCue]);
};
