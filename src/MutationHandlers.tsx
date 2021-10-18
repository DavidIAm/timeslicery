import { Caption } from "./Caption";
import { useClock } from "./Util";
import { mutateCaption, Mutation, MutationActions } from "./Mutation";
import { v4 } from "uuid";

type ReplaceMutationFromPartial = (
  caption: Caption,
  note: string,
  captionToPartial: (c: Caption) => Partial<Caption>
) => Mutation<Caption>;

const rmfp: ReplaceMutationFromPartial = (
  caption: Caption,
  note: string,
  whatToDo: (c: Caption) => Partial<Caption>
): Mutation<Caption> => {
  console.log("mustation on caption:", caption.text, note, whatToDo(caption));
  return mutateCaption({
    action: MutationActions.REPLACE,
    after: Object.assign({}, caption, whatToDo(caption), { uuid: v4() }),
    before: Caption.clone(caption),
    note,
  });
};

export const useMutationHandlers: (
  dispatch: (m: Mutation<Caption>) => void
) => void = (dispatch) => {
  useClock(
    "gapBefore",
    (caption) => {
      if (!caption) throw new Error("can't consume gap before unknown caption");
      dispatch(
        rmfp(caption, "consume gap before", (c) => ({
          start: c.start - (c?.backSize || 0) / 1000,
        }))
      );
    },
    [dispatch, rmfp]
  );

  useClock(
    "gapAfter",
    (caption) => {
      if (!caption) throw new Error("can't consume gap after unknown caption");
      dispatch(
        rmfp(caption, "consume gap after", (c) => ({
          end: c.end + (c?.foreSize || 0) / 1000,
        }))
      );
    },
    [dispatch, rmfp]
  );

  useClock(
    "newStartFor",
    (time, note, caption) => {
      if (!caption) throw new Error("Can't do newStartFor an unknown caption");
      dispatch(
        rmfp(caption, "new start : " + note, () => ({
          start: time,
        }))
      );
    },
    [dispatch, rmfp]
  );

  useClock(
    "newEndFor",
    (time, note, caption) => {
      console.log("new end for", caption, time, note);
      if (!caption) throw new Error("can't add new voice for unknown caption");
      return dispatch(
        rmfp(caption, "new end : " + note, () => ({
          end: time,
        }))
      );
    },
    [dispatch, rmfp]
  );

  useClock(
    "newTextFor",
    (text, note, caption) => {
      if (!caption) throw new Error("can't add new voice for unknown caption");
      console.log("new text for", text, caption, note);
      return dispatch(
        rmfp(caption, "new text : " + note, () => ({
          text,
        }))
      );
    },
    [dispatch, rmfp]
  );

  useClock(
    "newVoiceFor",
    (voice, note, caption) => {
      if (!caption) throw new Error("can't add new voice for unknown caption");
      console.log("new voice for", voice, caption, note);
      return dispatch(
        rmfp(caption, "new voice : " + note, () => ({
          voice,
        }))
      );
    },
    [dispatch, rmfp]
  );
};
