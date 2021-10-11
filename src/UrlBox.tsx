import React, {
  Reducer,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { Transcript } from "./Transcript";
import { Caption } from "./Caption";
import { parserFactory } from "./Util";
import { MediaBox } from "./MediaBox";
import { v4 } from "uuid";
import { CaptionFile } from "./CaptionFile";
import { makeMutation, Mutation, MutationActions } from "./Mutation";
import { MutationHandlers } from "./MutationHandlers";

export const UrlBox: React.FC = () => {
  const [src, setSrc] = useState<string>("/S3E3_Get_Help.mp3");
  const [transcript, setTranscript] = useState<string>(
    "/S3E3_Get_Help_fuckedup.vtt"
  );

  const CfReducer: Reducer<CaptionFile, Mutation> = (cf, mutation) => {
    const start = Date.now();
    const ccf = cf.applyMutation(mutation);
    console.log(
      "applying mutation and took",
      mutation.action,
      Date.now() - start,
      ccf.changes.length
    );
    return ccf;
  };
  const [captionFile, dispatch] = useReducer(CfReducer, void 0, (ca) => {
    console.log("new caption file from reducer init");
    return new CaptionFile(ca);
  });

  const replaceMutationFromPartial = useCallback(
    (
      caption: Caption,
      note: string,
      whatToDo: (c: Caption) => Partial<Caption>
    ): void => {
      console.log(whatToDo(caption));
      dispatch(
        makeMutation({
          action: MutationActions.REPLACE,
          after: Object.assign({}, caption, whatToDo(caption), { uuid: v4() }),
          before: caption,
          note,
        })
      );
    },
    [dispatch]
  );

  useEffect(() => {
    if (!transcript) return;
    if (!dispatch) return;
    if (!parserFactory) return;
    fetch(transcript).then((res) => res?.body?.pipeTo(parserFactory(dispatch)));
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
      <MutationHandlers
        replaceMutationFromPartial={replaceMutationFromPartial}
      />
      <Transcript transcript={captionFile} />
    </>
  );
};
