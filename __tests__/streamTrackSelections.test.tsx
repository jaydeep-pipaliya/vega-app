import renderer, {act} from 'react-test-renderer';
import {SelectedTrackType, SelectedVideoTrackType} from 'react-native-video';
import {useStreamTrackSelections} from '../src/lib/hooks/useStreamTrackSelections';

let tracks: ReturnType<typeof useStreamTrackSelections>;
const Harness = ({stream}: {stream: object}) => {
  tracks = useStreamTrackSelections(stream);
  return null;
};

const pickTracks = () => {
  tracks.setSelectedAudioTrack({type: SelectedTrackType.INDEX, value: 2});
  tracks.setSelectedTextTrack({type: SelectedTrackType.INDEX, value: 4});
  tracks.setSelectedVideoTrack({type: SelectedVideoTrackType.INDEX, value: 3});
};

const expectDefaults = () => {
  expect(tracks.selectedAudioTrack).toEqual({
    type: SelectedTrackType.INDEX,
    value: 0,
  });
  expect(tracks.selectedTextTrack).toEqual({type: SelectedTrackType.DISABLED});
  expect(tracks.selectedVideoTrack).toEqual({
    type: SelectedVideoTrackType.AUTO,
  });
};

it('starts with the first audio track, no subtitles and auto quality', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Harness stream={{link: 'a'}} />);
  });
  expectDefaults();
  act(() => tree.unmount());
});

it('resets picked tracks when the stream changes', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Harness stream={{link: 'a'}} />);
  });
  act(pickTracks);
  act(() => tree.update(<Harness stream={{link: 'b'}} />));
  expectDefaults();
  act(() => tree.unmount());
});

it('keeps picked tracks while the stream stays the same', () => {
  const stream = {link: 'a'};
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Harness stream={stream} />);
  });
  act(pickTracks);
  act(() => tree.update(<Harness stream={stream} />));
  expect(tracks.selectedVideoTrack).toEqual({
    type: SelectedVideoTrackType.INDEX,
    value: 3,
  });
  expect(tracks.selectedTextTrack).toEqual({
    type: SelectedTrackType.INDEX,
    value: 4,
  });
  act(() => tree.unmount());
});
