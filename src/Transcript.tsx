import React, { createContext } from "react";
import EventEmitter from "events";
import ReactAudioPlayer from "react-audio-player";
import { CaptionFile } from "./Caption";
import { Lines } from "./Lines";

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
  return (
    <div style={{ width: "100%" }}>
      <Lines all={transcript.captions} />
    </div>
  );
};

export type RangeSetter = (e: number, f: number) => void;
