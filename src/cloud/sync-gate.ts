import type { CloudAdapter } from './types';
export type SyncStopReason='paused'|'offline'|'sign-in'|'verify-email'|'closed';
export class SyncInterrupted extends Error{
  constructor(readonly reason:SyncStopReason){super('Synchronization stopped before the next remote operation.');this.name='SyncInterrupted';}
}
/** Already-started remote commits can be acknowledged in their original
 * namespace. A stop blocks every following operation, including a long queue. */
export function guardedCloudAdapter(adapter:CloudAdapter,stop:()=>SyncStopReason|null):CloudAdapter{
  const assertReady=()=>{const reason=stop();if(reason)throw new SyncInterrupted(reason);};
  return {async pull(cursor){assertReady();return adapter.pull(cursor);},async push(command){assertReady();return adapter.push(command);}};
}
