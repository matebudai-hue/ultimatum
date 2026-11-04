import type {FirestoreSettings} from 'firebase/firestore';
// WebKit can buffer streaming responses until their long-running HTTP request
// closes. Force discrete responses there; keep auto-detection on other engines.
export function firestoreTransport(userAgent:string):FirestoreSettings{
 const webkit=/AppleWebKit/i.test(userAgent)&&(/iPhone|iPad|iPod/i.test(userAgent)||!/Chrome|Chromium|Edg/i.test(userAgent));
 return webkit?{experimentalForceLongPolling:true,experimentalLongPollingOptions:{timeoutSeconds:10}}:{experimentalAutoDetectLongPolling:true};
}
