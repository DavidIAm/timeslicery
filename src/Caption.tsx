export interface Caption {
  uuid: string;
  startRaw: string;
  endRaw: string;
  align: string;
  voice: string;
  text: string;
  start: number;
  end: number;
  index?: number;
  backSize?: number;
  foreSize?: number;
  nextCaption?: string;
  prevCaption?: string;
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
