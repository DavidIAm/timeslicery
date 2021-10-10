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

  const CfReducer: Reducer<CaptionFile, Mutation> = (cf, mutation) =>
    cf.applyMutation(mutation);
  const [captions, dispatch] = useReducer(CfReducer, [], (ca) => {
    return new CaptionFile(ca);
  });

  const replaceMutationFromPartial = useCallback(
    (
      uuid: string,
      note: string,
      whatToDo: (c: Caption) => Partial<Caption>
    ): void => {
      captions
        .byUuid(uuid)
        .then((c) =>
          dispatch(
            makeMutation({
              action: MutationActions.REPLACE,
              after: Object.assign({}, c, whatToDo(c), { uuid: v4() }),
              before: c,
              note,
              when: new Date(),
            })
          )
        )
        .catch((e) => {
          throw e;
        });
    },
    [captions, dispatch]
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
        {captions.changes
          .map((m, i) => (
            <p key={v4()}>
              {i}: {m.note}
            </p>
          ))
          .slice(Math.max(captions.changes.length - 10, 0))}
        <hr />
        {captions.undoneChanges
          .map((m, i) => (
            <p key={v4()}>
              {i}: {m.note}
            </p>
          ))
          .slice(Math.max(0, 5))}
      </>
    ),
    [captions.changes, captions.undoneChanges]
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
      <Transcript transcript={captions} />
    </>
  );
};
