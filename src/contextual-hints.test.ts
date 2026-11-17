import { describe,expect,it } from 'vitest';
import { dismissHint,hintDismissed,hintStorageKey } from './contextual-hints';
import type { TourStorage } from './tour';
function memoryStorage():TourStorage{const values=new Map<string,string>();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);}};}
describe('optional contextual hints',()=>{
  it('persists dismissal only for the specific account and hint',()=>{
    const storage=memoryStorage();
    expect(hintDismissed('local:hints-one','atlas',storage)).toBe(false);
    expect(dismissHint('local:hints-one','atlas',storage)).toBe(true);
    expect(storage.getItem(hintStorageKey('local:hints-one','atlas'))).toBe('dismissed');
    expect(hintDismissed('local:hints-one','atlas',storage)).toBe(true);
    expect(hintDismissed('local:hints-two','atlas',storage)).toBe(false);
    expect(hintDismissed('local:hints-one','focus',storage)).toBe(false);
    expect(hintStorageKey('a:b','c')).not.toBe(hintStorageKey('a','b:c'));
  });
  it('remembers dismissal in this session when browser storage fails',()=>{
    const blocked:TourStorage={getItem:()=>{throw new Error('Blocked');},setItem:()=>{throw new Error('Quota');}};
    expect(hintDismissed('local:hints-blocked','collection',blocked)).toBe(false);
    expect(dismissHint('local:hints-blocked','collection',blocked)).toBe(false);
    expect(hintDismissed('local:hints-blocked','collection',blocked)).toBe(true);
    expect(dismissHint('local:hints-no-storage','focus',null)).toBe(false);
    expect(hintDismissed('local:hints-no-storage','focus',null)).toBe(true);
  });
});
