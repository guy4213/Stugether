import "server-only";

// ICE servers for the room call (WebRTC mesh, Change Request 30.10.2026).
// Public STUN is enough on most networks; behind strict NATs / campus
// firewalls a TURN relay is needed — set WEBRTC_TURN_URL (comma-separated
// for several), WEBRTC_TURN_USERNAME and WEBRTC_TURN_CREDENTIAL. The TURN
// credential necessarily reaches the browser, so use a dedicated,
// rate-limited TURN account (or short-lived credentials) for it.
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const DEFAULT_STUN = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

export function getIceServers(): IceServer[] {
  const servers: IceServer[] = [{ urls: DEFAULT_STUN }];
  const turn = process.env.WEBRTC_TURN_URL?.split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (turn && turn.length > 0) {
    servers.push({
      urls: turn,
      username: process.env.WEBRTC_TURN_USERNAME,
      credential: process.env.WEBRTC_TURN_CREDENTIAL,
    });
  }
  return servers;
}
