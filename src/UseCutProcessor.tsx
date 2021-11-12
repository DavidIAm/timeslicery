import { Caption, PLC } from "./Caption";
import { useCallback, useContext, useEffect } from "react";
import { EditContext } from "./Transcript";

export const useCutProcessor = (playLoopCue: PLC, caption: Caption) => {
  const { clock } = useContext(EditContext);
  const cutPrev = useCallback(() => {
    clock.emit(
      "withTime",
      "newEndFor",
      "cut to prev - end of prev",
      caption.prevCaption
    );
    clock.emit(
      "withTime",
      "newStartFor",
      "cut to prev - start of current",
      caption
    );
  }, [clock, caption]);

  const cutNext = useCallback(() => {
    console.log("Activate CutNext");
    clock.emit(
      "withTime",
      "newEndFor",
      "cut to next - end of current",
      caption
    );
    clock.emit(
      "withTime",
      "newStartFor",
      "cut to next - start of next",
      caption.nextCaption
    );
  }, [clock, caption]);
  useEffect(() => {
    switch (playLoopCue) {
      case PLC.PAUSE:
        break;
      case PLC.PLAY:
      case PLC.ENTRY:
      case PLC.CUE:
        clock.on("cutToPrev", cutPrev);
        clock.on("cutToNext", cutNext);
        return (): void => {
          clock.off("cutToPrev", cutPrev);
          clock.off("cutToNext", cutNext);
        };
    }
  }, [clock, cutPrev, cutNext, playLoopCue]);
};
