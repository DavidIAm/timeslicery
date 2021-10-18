export interface Caption {
  uuid: string;
  startRaw?: string;
  endRaw?: string;
  align: string;
  voice?: string;
  text: string;
  start: number;
  end: number;
  index?: number;
  backSize?: number;
  foreSize?: number;
  nextCaption?: Caption;
  prevCaption?: Caption;
  AUTHORITATIVE?: Boolean;
}

const ignoreFields = [
  "uuid",
  "index",
  "backSize",
  "foreSize",
  "nextCaption",
  "prevCaption",
  "AUTHORITATIVE",
  "startRaw",
  "endRaw",
];

export class Caption {
  static clone({ uuid, align, text, voice, start, end }: Caption): Caption {
    return { uuid, align, text, voice, start, end };
  }

  static equals(a: Caption, b: Caption) {
    const akeys = Object.keys(a).filter(
      (k) => !ignoreFields.includes(k)
    ) as (keyof Caption)[];
    const bkeys = Object.keys(b).filter(
      (k) => !ignoreFields.includes(k)
    ) as (keyof Caption)[];
    if (akeys.length !== bkeys.length) return false;
    return !akeys.find((ak) => a[ak] !== b[ak]);
  }
}

// export const cloneCaption: (
//   caption: Caption,
//   start: number,
//   end: number
// ) => Caption = (caption, start, end) => {
//   return Object.assign({}, caption, { uuid: v4(), start, end });
// };

export enum PLC {
  PAUSE,
  PLAY,
  ENTRY,
  CUE,
}

export enum CUE_STATE {
  CUE_START,
  CUE_OFF,
  CUE_IN,
  CUE_GAP,
  CUE_SAVE,
  CUE_CANCEL,
}

export type Change = {
  when: Modification[];
};
export type Modification = {
  when: Date;
  previous: Caption;
  next: Caption;
};
