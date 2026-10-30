"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomBroadcastEvent } from "@/hooks/useRoomChannel";

// Voice / video / screen sharing for a room (Change Request 30.10.2026).
// A WebRTC mesh: with 2-4 members every pair holds one RTCPeerConnection,
// so no media server is needed. Signaling rides the room channel
// (useRoomChannel's "call" broadcast).
//
// Every member who can post joins the mesh on entry in listen-only mode, so
// they hear and see whoever turns on a mic / camera / screen. Each
// connection has exactly one audio and one video transceiver, created by the
// offerer; mic, camera and screen are swapped with replaceTrack(), so turning
// them on or off never renegotiates.
//
// Who offers is fixed: the higher user id. A "hello" (with a per-join nonce)
// announces a member; the lower id answers it with a directed hello, so a
// simultaneous join ends with one offer per pair.

type Signal = {
  from: string;
  to?: string;
  nonce: string;
  kind: "hello" | "bye" | "sdp" | "ice" | "state";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  state?: MediaState;
};

export type MediaState = { mic: boolean; cam: boolean; screen: boolean };

export type RemotePeer = MediaState & {
  userId: string;
  stream: MediaStream;
  connected: boolean;
};

type Peer = {
  pc: RTCPeerConnection;
  nonce: string;
  stream: MediaStream;
  pendingIce: RTCIceCandidateInit[];
  state: MediaState;
};

const OFF: MediaState = { mic: false, cam: false, screen: false };

export function useRoomCall({
  userId,
  enabled,
  ready,
  onlineUserIds,
  iceServers,
  broadcast,
}: {
  userId: string;
  /** Member of an active room, not demo mode. */
  enabled: boolean;
  /** The room channel is subscribed. */
  ready: boolean;
  onlineUserIds: string[];
  iceServers: RTCIceServer[];
  broadcast: (event: RoomBroadcastEvent, payload: Record<string, unknown>) => void;
}) {
  const [local, setLocal] = useState<MediaState>(OFF);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const peersRef = useRef(new Map<string, Peer>());
  const nonceRef = useRef<string>("");
  const localRef = useRef<MediaState>(OFF);
  const tracks = useRef<{
    mic: MediaStreamTrack | null;
    cam: MediaStreamTrack | null;
    screen: MediaStreamTrack | null;
  }>({ mic: null, cam: null, screen: null });
  const iceRef = useRef(iceServers);
  const enabledRef = useRef(enabled);
  const seenOnline = useRef(new Set<string>());
  const broadcastRef = useRef(broadcast);
  useEffect(() => {
    iceRef.current = iceServers;
    enabledRef.current = enabled;
    broadcastRef.current = broadcast;
  });

  const send = useCallback(
    (signal: Omit<Signal, "from" | "nonce">) => {
      broadcastRef.current("call", { ...signal, from: userId, nonce: nonceRef.current });
    },
    [userId],
  );

  const publishPeers = useCallback(() => {
    setPeers(
      [...peersRef.current.entries()].map(([id, p]) => ({
        userId: id,
        stream: p.stream,
        connected: p.pc.connectionState === "connected",
        ...p.state,
      })),
    );
  }, []);

  const outgoingVideo = () => tracks.current.screen ?? tracks.current.cam;

  // Point every connection's senders at the current local tracks.
  const syncSenders = useCallback(() => {
    for (const p of peersRef.current.values()) {
      for (const t of p.pc.getTransceivers()) {
        const kind = t.receiver.track.kind;
        const track = kind === "audio" ? tracks.current.mic : outgoingVideo();
        if (t.sender.track !== track) void t.sender.replaceTrack(track).catch(() => {});
      }
    }
  }, []);

  const closePeer = useCallback(
    (id: string) => {
      const p = peersRef.current.get(id);
      if (!p) return;
      p.pc.close();
      peersRef.current.delete(id);
      publishPeers();
    },
    [publishPeers],
  );

  const createPeer = useCallback(
    (id: string, nonce: string): Peer => {
      closePeer(id);
      const pc = new RTCPeerConnection({ iceServers: iceRef.current });
      const peer: Peer = { pc, nonce, stream: new MediaStream(), pendingIce: [], state: OFF };
      peersRef.current.set(id, peer);

      pc.onicecandidate = (e) => {
        if (e.candidate) send({ kind: "ice", to: id, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        if (!peer.stream.getTracks().includes(e.track)) peer.stream.addTrack(e.track);
        publishPeers();
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          send({ kind: "state", to: id, state: localRef.current });
        }
        if (pc.connectionState === "failed") closePeer(id);
        publishPeers();
      };
      publishPeers();
      return peer;
    },
    [closePeer, publishPeers, send],
  );

  const offerTo = useCallback(
    async (id: string, nonce: string) => {
      const { pc } = createPeer(id, nonce);
      pc.addTransceiver(tracks.current.mic ?? "audio", { direction: "sendrecv" });
      pc.addTransceiver(outgoingVideo() ?? "video", { direction: "sendrecv" });
      await pc.setLocalDescription(await pc.createOffer());
      send({ kind: "sdp", to: id, description: pc.localDescription!.toJSON() });
    },
    [createPeer, send],
  );

  const flushIce = async (peer: Peer) => {
    for (const c of peer.pendingIce.splice(0)) {
      await peer.pc.addIceCandidate(c).catch(() => {});
    }
  };

  const handleSignal = useCallback(
    async (s: Signal) => {
      if (!enabledRef.current) return;
      if (s.from === userId || (s.to && s.to !== userId)) return;
      const existing = peersRef.current.get(s.from);

      switch (s.kind) {
        case "hello": {
          // Same join we already connect to: nothing to do.
          if (existing && existing.nonce === s.nonce) return;
          if (userId > s.from) await offerTo(s.from, s.nonce);
          else {
            if (existing) closePeer(s.from);
            send({ kind: "hello", to: s.from });
          }
          return;
        }
        case "bye":
          closePeer(s.from);
          return;
        case "sdp": {
          const description = s.description;
          if (!description) return;
          if (description.type === "offer") {
            const peer = createPeer(s.from, s.nonce);
            await peer.pc.setRemoteDescription(description);
            for (const t of peer.pc.getTransceivers()) {
              t.direction = "sendrecv";
              const track =
                t.receiver.track.kind === "audio" ? tracks.current.mic : outgoingVideo();
              await t.sender.replaceTrack(track).catch(() => {});
            }
            await peer.pc.setLocalDescription(await peer.pc.createAnswer());
            send({ kind: "sdp", to: s.from, description: peer.pc.localDescription!.toJSON() });
            await flushIce(peer);
          } else if (existing && existing.pc.signalingState === "have-local-offer") {
            await existing.pc.setRemoteDescription(description);
            await flushIce(existing);
          }
          return;
        }
        case "ice": {
          if (!existing || !s.candidate) return;
          if (existing.pc.remoteDescription) {
            await existing.pc.addIceCandidate(s.candidate).catch(() => {});
          } else existing.pendingIce.push(s.candidate);
          return;
        }
        case "state":
          if (existing && s.state) {
            existing.state = s.state;
            publishPeers();
          }
          return;
      }
    },
    [userId, offerTo, closePeer, createPeer, send, publishPeers],
  );

  const onCallSignal = useCallback(
    (payload: Record<string, unknown>) => {
      void handleSignal(payload as unknown as Signal).catch((err) =>
        console.error("[call] signal failed", err),
      );
    },
    [handleSignal],
  );

  // Join once the channel is up; leave on unmount / when no longer allowed.
  useEffect(() => {
    if (!enabled || !ready || typeof RTCPeerConnection === "undefined") return;
    nonceRef.current = crypto.randomUUID();
    send({ kind: "hello" });
    const peersMap = peersRef.current;
    const media = tracks.current;
    return () => {
      send({ kind: "bye" });
      for (const p of peersMap.values()) p.pc.close();
      peersMap.clear();
      for (const t of [media.mic, media.cam, media.screen]) t?.stop();
      tracks.current = { mic: null, cam: null, screen: null };
      localRef.current = OFF;
      setLocal(OFF);
      setLocalStream(null);
      setPeers([]);
    };
  }, [enabled, ready, send]);

  // A member who dropped off presence (closed the tab) without a "bye".
  useEffect(() => {
    // Only someone presence already showed and now doesn't: a hello can
    // arrive before the presence sync that includes its sender.
    const online = new Set(onlineUserIds);
    for (const id of seenOnline.current) if (!online.has(id)) closePeer(id);
    seenOnline.current = online;
  }, [onlineUserIds, closePeer]);

  const applyLocal = useCallback(
    (next: MediaState) => {
      localRef.current = next;
      setLocal(next);
      const live = [tracks.current.mic, outgoingVideo()].filter(
        (t): t is MediaStreamTrack => t !== null,
      );
      setLocalStream(live.length > 0 ? new MediaStream(live) : null);
      syncSenders();
      send({ kind: "state", state: next });
    },
    [send, syncSenders],
  );

  const mediaError = (err: unknown) => {
    const name = (err as { name?: string } | null)?.name;
    setError(
      name === "NotAllowedError"
        ? "הדפדפן חסם את הגישה. אפשרו מיקרופון / מצלמה בהגדרות האתר"
        : name === "NotFoundError"
          ? "לא נמצא מכשיר מתאים"
          : "לא ניתן להפעיל את המכשיר",
    );
  };

  const toggleMic = useCallback(async () => {
    setError(null);
    if (tracks.current.mic) {
      tracks.current.mic.stop();
      tracks.current.mic = null;
      applyLocal({ ...localRef.current, mic: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      tracks.current.mic = stream.getAudioTracks()[0] ?? null;
      applyLocal({ ...localRef.current, mic: !!tracks.current.mic });
    } catch (err) {
      mediaError(err);
    }
  }, [applyLocal]);

  const toggleCam = useCallback(async () => {
    setError(null);
    if (tracks.current.cam) {
      tracks.current.cam.stop();
      tracks.current.cam = null;
      applyLocal({ ...localRef.current, cam: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { max: 24 } },
      });
      tracks.current.cam = stream.getVideoTracks()[0] ?? null;
      applyLocal({ ...localRef.current, cam: !!tracks.current.cam });
    } catch (err) {
      mediaError(err);
    }
  }, [applyLocal]);

  const toggleScreen = useCallback(async () => {
    setError(null);
    if (tracks.current.screen) {
      tracks.current.screen.stop();
      tracks.current.screen = null;
      applyLocal({ ...localRef.current, screen: false });
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("שיתוף מסך אינו נתמך בדפדפן הזה");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0] ?? null;
      if (!track) return;
      // The browser's own "stop sharing" bar.
      track.onended = () => {
        if (tracks.current.screen !== track) return;
        tracks.current.screen = null;
        applyLocal({ ...localRef.current, screen: false });
      };
      tracks.current.screen = track;
      applyLocal({ ...localRef.current, screen: true });
    } catch (err) {
      // Cancelling the picker is not an error worth showing.
      if ((err as { name?: string } | null)?.name !== "NotAllowedError") mediaError(err);
    }
  }, [applyLocal]);

  return {
    supported: typeof window !== "undefined" && typeof RTCPeerConnection !== "undefined",
    local,
    localStream,
    peers,
    error,
    toggleMic,
    toggleCam,
    toggleScreen,
    onCallSignal,
  };
}
