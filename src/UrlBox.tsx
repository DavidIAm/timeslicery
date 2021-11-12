import React, {
  Reducer,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Transcript } from "./Transcript";
import { parserFactory } from "./Util";
import { MediaBox } from "./MediaBox";
import { v4 } from "uuid";
import { CaptionFile } from "./CaptionFile";
import { Mutation } from "./Mutation";
import { useMutationHandlers } from "./MutationHandlers";
import { Caption } from "./Caption";

export const UrlBox: React.FC = () => {
  const [src, setSrc] = useState<string>("/S3E3_Get_Help.mp3");
  const [transcript, setTranscript] = useState<string>(
    "/S3E3_Get_Help_fuckedup.vtt"
  );

  const cccf = useRef<CaptionFile>(new CaptionFile());
  const CfReducer: Reducer<CaptionFile, Mutation<Caption>> = (cf, mutation) => {
    const ccf = cccf.current.applyMutation(mutation);
    cccf.current = ccf;
    return ccf;
  };
  const [captionFile, dispatch] = useReducer(CfReducer, void 0, (ca) => {
    return new CaptionFile(ca);
  });

  const [, forHeader] = useState<string>("");
  useEffect(() => {
    if (!transcript) return;
    if (!dispatch) return;
    if (!parserFactory) return;
    fetch(transcript).then((res) =>
      res?.body?.pipeTo(parserFactory(dispatch, forHeader))
    );
  }, [transcript]);

  const noteSet = useMemo(
    () => (
      <>
        {captionFile.changes
          .map((m, i) => (
            <p key={v4()}>
              {i}: {m.note}
            </p>
          ))
          .slice(Math.max(captionFile.changes.length - 10, 0))}
        <hr />
        {captionFile.undoneChanges
          .map((m, i) => (
            <p key={v4()}>
              {i}: {m.note}
            </p>
          ))
          .slice(Math.max(0, 5))}
      </>
    ),
    [captionFile.changes, captionFile.undoneChanges]
  );

  useMutationHandlers(dispatch);

  return (
    <>
      <div
        style={{
          position: "fixed",
          textAlign: "left",
          right: 0,
          top: 0,
          fontSize: "10px",
          color: "white",
          backgroundColor: "dimgrey",
        }}
      >
        {noteSet}
      </div>
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
      <Transcript transcript={captionFile} />
    </>
  );
};
