export interface Caption {
  start: number;
  startRaw: string;
  end: number;
  endRaw: string;
  align: string;
  voice: string;
  text: string;
  index?: number;
  backSize?: number;
  foreSize?: number;
}

export interface CaptionFile {
  captions: Caption[];
  format: string;
  text: string;
  chunks: { [key: number]: Caption[] };
}
