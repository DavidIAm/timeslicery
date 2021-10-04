import React, { useContext, useEffect, useReducer, useState } from "react";
import { EditContext, Transcript } from "./Transcript";
import { Caption, CaptionFile } from "./Caption";
import { parserFactory } from "./Util";
import { MediaBox } from "./MediaBox";

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
    (cf, { array = [], clear, done, chunk }) => {
      if (clear) {
        cf.chunks = {};
        cf.captions = [];
        voiceDispatch({ voices: [], clear: true });
      }
      cf.chunks[chunk] = array;
      cf.captions = Object.values(cf.chunks)
        .flatMap((i) => i)
        .sort((a, b) => a.start - b.start);
      voiceDispatch({
        voices: cf.captions.map(({ voice }) => voice),
        clear: false,
      });
      cf.captions.forEach((value, index, arr) => {
        value.index = index;
        value.backSize = (value.start - arr[Math.max(index - 1, 0)].end) * 1000;
        value.foreSize =
          (arr[Math.min(index + 1, arr.length - 1)].start - value.end) * 1000;
      });
      return Object.assign({}, cf);
    },
    { captions: [], format: "", text: "", chunks: [] } as CaptionFile,
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
