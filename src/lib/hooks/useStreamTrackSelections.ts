import {useEffect, useRef, useState} from 'react';
import {
  SelectedTrack,
  SelectedTrackType,
  SelectedVideoTrack,
  SelectedVideoTrackType,
} from 'react-native-video';

const defaultAudioTrack = (): SelectedTrack => ({
  type: SelectedTrackType.INDEX,
  value: 0,
});
const defaultTextTrack = (): SelectedTrack => ({
  type: SelectedTrackType.DISABLED,
});
const defaultVideoTrack = (): SelectedVideoTrack => ({
  type: SelectedVideoTrackType.AUTO,
});

// Audio, subtitle and quality selections passed to the player. They go back to
// the defaults whenever the stream changes, so a track index picked on one
// stream is never applied to another one. Saved language picks are applied on
// top once the new stream reports its tracks.
export const useStreamTrackSelections = (stream: unknown) => {
  const [selectedAudioTrack, setSelectedAudioTrack] =
    useState<SelectedTrack>(defaultAudioTrack);
  const [selectedTextTrack, setSelectedTextTrack] =
    useState<SelectedTrack>(defaultTextTrack);
  const [selectedVideoTrack, setSelectedVideoTrack] =
    useState<SelectedVideoTrack>(defaultVideoTrack);

  const lastStreamRef = useRef(stream);
  useEffect(() => {
    if (lastStreamRef.current === stream) {
      return;
    }
    lastStreamRef.current = stream;
    setSelectedAudioTrack(defaultAudioTrack());
    setSelectedTextTrack(defaultTextTrack());
    setSelectedVideoTrack(defaultVideoTrack());
  }, [stream]);

  return {
    selectedAudioTrack,
    setSelectedAudioTrack,
    selectedTextTrack,
    setSelectedTextTrack,
    selectedVideoTrack,
    setSelectedVideoTrack,
  };
};
