import React, { useCallback, useContext, useEffect } from "react";
import { Caption } from "./Caption";
import { EditContext } from "./Transcript";
import { format } from "./Util";

export const DrawOut: React.FC<{
  caption: Caption;
  audioPlayer: HTMLAudioElement;
}> = ({ caption, audioPlayer }) => {
  const { clock } = useContext(EditContext);
  const drawOutDone = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      console.log("ENNDING DRAW OUT", format(audioPlayer.currentTime));
      clock.emit("newEndFor", caption, audioPlayer.currentTime);
      audioPlayer.currentTime = caption.start;
    },
    [audioPlayer, clock]
  );

  const drawOutStart = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      console.log("STARTING DRAW OUT");
      audioPlayer.currentTime = caption.start;
      audioPlayer.play();
    },
    [audioPlayer]
  );
  useEffect(() => {
    clock.on("drawOutStart", drawOutStart);
    clock.on("drawOutDone", drawOutDone);
    return (): void => {
      clock.off("drawOutStart", drawOutStart);
      clock.off("drawOutDone", drawOutDone);
    };
  }, [clock, drawOutStart, drawOutDone]);
  return <></>;
};
