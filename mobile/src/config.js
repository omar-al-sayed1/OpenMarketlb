import Constants from 'expo-constants';

/**
 * Base URL of the FastAPI backend.
 *
 * In development we auto-detect the IP of the machine running Metro (your PC),
 * so it works on a physical phone AND on emulators without editing anything —
 * as long as the phone is on the same Wi-Fi and the backend runs with
 *   uvicorn server_modular:app --host 0.0.0.0 --port 8001
 *
 * For a production build, set API_OVERRIDE to your deployed API, e.g.
 *   const API_OVERRIDE = 'https://api.openmarket.com';
 */
// Dev (Expo Go): auto-detect the Metro host so the phone reaches your PC's backend.
// Production builds: there is no Metro host, so we MUST point at the live API.
const API_OVERRIDE = __DEV__ ? null : 'https://openmarketlb.com';
const PORT = 8001;

function detectHost() {
  // expoConfig.hostUri looks like "192.168.1.20:8081"
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  return host || 'localhost';
}

export const API_BASE_URL = API_OVERRIDE
  ? `${API_OVERRIDE.replace(/\/$/, '')}/api`
  : `http://${detectHost()}:${PORT}/api`;
