import React, {
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import { EditContext } from "./Transcript";
import { Caption } from "./Caption";
import ReactAudioPlayer from "react-audio-player";
import { format } from "./Util";

export type LoopState = {
  looping: Boolean;
  start: number;
  end: number;
};

const listenInterval = 200;

export const MediaBox: React.FC<{ audio: string }> = ({ audio }) => {
  const { clock } = useContext(EditContext);

  const [volume, setVolume] = useState<number>(0.5);
  useEffect(() => console.log("volume change"), [volume]);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>();
  useEffect(() => console.log("audioPlayer change"), [audioPlayer]);
  useEffect(() => {
    console.log("change audioplayer/clock trigger");
    if (!audioPlayer) return;
    if (!clock) return;
    clock.emit("newAudioPlayer", audioPlayer);
  }, [audioPlayer, clock]);
  useEffect(() => {
    if (!audioPlayer) return;
    console.log("audioPlayerVolume");
    audioPlayer.volume = volume;
  }, [audioPlayer, volume]);

  const [blurPause, dispatchBlurPause] = useReducer<
    (p: boolean, f: boolean) => boolean,
    boolean
  >(
    (p, f) => f,
    false,
    (t) => t
  );

  const [play, togglePlay] = useReducer<
    (p: boolean, f: boolean) => boolean,
    boolean
  >(
    (p, force) => (force === true || force === false ? force : !p),
    false,
    (t) => t
  );

  const [playbackRate, setPlaybackRate] = useState<number>(1);
  useEffect(() => console.log("playbackRate change"), [playbackRate]);
  useEffect(() => {
    const toggler = (force: boolean) => togglePlay(force);
    clock.on("blurPause", dispatchBlurPause);
    clock.on("playbackRate", setPlaybackRate);
    clock.on("togglePlay", toggler);
    return (): void => {
      clock.off("togglePlay", toggler);
      clock.off("playbackRate", setPlaybackRate);
      clock.off("blurPause", dispatchBlurPause);
    };
  }, [clock]);

  const cueIn = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      if (!caption) return;
      console.log("CUE IN", format(audioPlayer.currentTime));
      clock.emit("newEndFor", {
        uuid: caption,
        time: audioPlayer.currentTime,
        note: "cue in",
      });
      clock.emit("newStartFor", {
        uuid: caption.nextCaption,
        time: audioPlayer.currentTime,
        note: "cue in",
      });
    },
    [clock, audioPlayer]
  );
  const cueOut = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      if (!caption) return;
      console.log("CUE OUT", format(audioPlayer.currentTime));
      clock.emit("newEndFor", caption, audioPlayer.currentTime);
      const { start, end } = caption;
      setLoop({ looping: true, start, end });
    },
    [clock, audioPlayer]
  );
  useEffect(() => {
    clock.on("cueIn", cueIn);
    clock.on("cueOut", cueOut);
    return (): void => {
      clock.off("cueIn", cueIn);
      clock.off("cueOut", cueOut);
    };
  }, [clock, cueIn, cueOut]);

  useEffect(() => {
    if (!audioPlayer) return;
    console.log("play/blur hook");
    if (blurPause) {
      audioPlayer.pause();
      clock.emit("time", audioPlayer.currentTime);
      return;
    }
    play ? audioPlayer.play() : audioPlayer.pause();
    clock.emit("time", audioPlayer.currentTime);
    clock.emit("playState", play);
  }, [audioPlayer, play, blurPause, clock]);

  useEffect(() => {
    if (!audioPlayer) return;
    console.log("playback Rate hook");
    audioPlayer.playbackRate = playbackRate;
  }, [audioPlayer, playbackRate]);

  // the loop toggle
  const [loop, setLoop] = useState<LoopState>({
    looping: false,
    start: 0,
    end: 0,
  });
  useEffect(() => {
    clock.on("setLoop", setLoop);
    return (): void => void clock.off("setLoop", setLoop);
  }, [clock]);

  useEffect(() => {
    if (!audioPlayer) return;
    if (!loop.looping) return;
    if (!play) return;
    let interval: number;
    let timeout = window.setTimeout(() => {
      timeout = 0;
      audioPlayer.currentTime = loop.start;
      console.log("loop initial backToStart");
      interval = window.setInterval(() => {
        console.log("loop backToStart");
        audioPlayer.currentTime = loop.start;
      }, ((loop.end - loop.start) * 1000) / playbackRate);
    }, ((loop.end - audioPlayer.currentTime) * 1000) / playbackRate);
    return (): void => {
      console.log("loop clear");
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [audioPlayer, play, playbackRate, loop]);

  useEffect(() => {
    if (!audioPlayer) return;
    console.log("setStart listener");
    const setStart = (time: number) => {
      console.log("setting time with setStart");
      audioPlayer.currentTime = time;
    };
    const doPlay = () => togglePlay(true);
    const doPause = () => togglePlay(false);
    clock.on("playFrom", setStart);
    clock.on("play", doPlay);
    clock.on("pause", doPause);
    return (): void => {
      clock.off("playFrom", setStart);
      clock.off("play", doPlay);
      clock.off("pause", doPause);
    };
  }, [clock, audioPlayer]);

  const jumpToHandler = useCallback(
    (c: Caption) => {
      clock.emit("time", c.start);
      if (!audioPlayer) return;
      if (typeof c.start === "undefined") {
        console.warn("jump h andle undefined?");
        return;
      }
      if (
        audioPlayer.currentTime >= c.start &&
        audioPlayer.currentTime <= c.end
      )
        return;
      console.log("jumping!", c.start);
      audioPlayer.currentTime = c.start;
    },
    [audioPlayer, clock]
  );

  useEffect(() => {
    clock.on("jumpToCaption", jumpToHandler);
    return (): void => void clock.off("jumpToCaption", jumpToHandler);
  }, [jumpToHandler, clock]);

  const emitTime = useCallback((t) => clock.emit("time", t), [clock]);
  return (
    <>
      <ReactAudioPlayer
        ref={(e) => {
          if (e && e?.audioEl && e.audioEl.current)
            setAudioPlayer(e?.audioEl.current);
        }}
        listenInterval={listenInterval}
        onListen={emitTime}
        src={audio}
        controls
      />
    </>
  );
};

export const DrawOut: React.FC<{
  caption: Caption;
  audioPlayer: HTMLAudioElement;
}> = ({ caption, audioPlayer }) => {
  const { clock } = useContext(EditContext);
  const drawOutDone = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      console.log("ENNDING DRAW OUT", format(audioPlayer.currentTime));
      clock.emit("newEndFor", caption, audioPlayer.currentTime);
      audioPlayer.currentTime = caption.start;
      //clock.emit("setLoop", true);
    },
    [audioPlayer, clock]
  );

  const drawOutStart = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      // clock.emit("setLoop", false);
      console.log("STARTING DRAW OUT");
      audioPlayer.currentTime = caption.start;
      audioPlayer.play();
    },
    [audioPlayer]
  );
  useEffect(() => {
    clock.on("drawOutStart", drawOutStart);
    clock.on("drawOutDone", drawOutDone);
    return (): void => {
      clock.off("drawOutStart", drawOutStart);
      clock.off("drawOutDone", drawOutDone);
    };
  }, [clock, drawOutStart, drawOutDone]);
  return <></>;
};
