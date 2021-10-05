import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import EventEmitter from "events";
import ReactAudioPlayer from "react-audio-player";
import { CaptionFile } from "./Caption";
import { Lines } from "./Lines";
import { format } from "./Util";

export const EditContext = createContext<{
  audio?: ReactAudioPlayer;
  clock: EventEmitter;
  keyboard: EventEmitter;
}>({
  clock: new EventEmitter(),
  keyboard: new EventEmitter(),
});

export const Transcript: React.FC<{ transcript: CaptionFile }> = ({
  transcript,
}) => {
  const { clock } = useContext(EditContext);

  const cutInHalf = useCallback(
    (index) => {
      console.log("CPATION", index);
      const caption = all[index];
      if (!caption) return;
      caption.end = caption.start + (caption.end - caption.start) / 2;
      caption.endRaw = format(caption.end);
    },
    [all]
  );
  useEffect(() => {
    clock.on("cutInHalf", cutInHalf);
    return (): void => {
      clock.off("cutInHalf", cutInHalf);
    };
  }, [clock]);

  return (
    <div style={{ width: "100%" }}>
      <Lines all={transcript.captions} />
    </div>
  );
};

export type RangeSetter = (e: number, f: number) => void;
