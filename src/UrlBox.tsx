import React, { useContext, useEffect, useReducer, useState } from "react";
import { EditContext, Transcript } from "./Transcript";
import { Caption, CaptionFile } from "./Caption";
import { parserFactory } from "./Util";
import { MediaBox } from "./MediaBox";
import { v4 } from "uuid";

export const UrlBox: React.FC = () => {
  const { clock } = useContext(EditContext);
  const [src, setSrc] = useState<string>("/S3E3_Get_Help.mp3");
  const [transcript, setTranscript] = useState<string>(
    "/S3E3_Get_Help_fuckedup.vtt"
  );

  const [voices, voiceDispatch] = useReducer<
    (
      voices: Set<string>,
      fresh: { voices: string[]; clear: boolean }
    ) => Set<string>,
    string[]
  >(
    (set, { voices, clear }) =>
      new Set<string>(clear ? [] : [...Array.from(set.values()), ...voices]),
    [],
    (t) => new Set<string>(t)
  );
  const [captions, dispatch] = useReducer<
    (
      cf: CaptionFile,
      fresh: { array?: Caption[]; clear: boolean; done: boolean; chunk: number }
    ) => CaptionFile,
    CaptionFile
  >(
    (cf, { array = [], clear, chunk }) => {
      if (clear) {
        cf.chunks = {};
        cf.captions = [];
        voiceDispatch({ voices: [], clear: true });
      }
      cf.chunks[chunk] = array;
      cf.add(Object.values(cf.chunks).flatMap((i) => i));
      cf.captions.forEach((value) => {
        value.uuid = v4();
      });
      return Object.assign({}, cf);
    },
    { chunks: [] },
    (t) => t
  );

  useEffect(() => void clock.emit("setVoices", voices), [voices, clock]);
  useEffect(() => {
    if (!transcript) return;
    if (!dispatch) return;
    if (!parserFactory) return;
    fetch(transcript).then((res) => res?.body?.pipeTo(parserFactory(dispatch)));
  }, [transcript]);

  return (
    <>
      <div>
        <label htmlFor={"source"}>Audio</label>
        <input
          name={"source"}
          type={"text"}
          defaultValue={src}
          onChange={(e) => setSrc(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={"transcript"}>Transcript</label>
        <input
          name={"transcript"}
          type={"transcript"}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
      </div>
      <MediaBox audio={src} />
      <Transcript transcript={captions} />
    </>
  );
};
