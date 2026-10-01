import { Composition } from "remotion";
import { Film, type FilmProps } from "./film/Film";
import { DURATION } from "./film/cues";

const meta = ({ props }: { props: FilmProps }) => ({ fps: props.fps, durationInFrames: Math.round(DURATION * props.fps) });

export function Root() {
  return (
    <Composition id="Deskling" component={Film} width={1920} height={1080} fps={60} durationInFrames={Math.round(DURATION * 60)}
      defaultProps={{ fps: 60, debug: false } satisfies FilmProps} calculateMetadata={meta} />
  );
}
