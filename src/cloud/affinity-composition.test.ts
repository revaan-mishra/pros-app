import { describe,expect,it } from 'vitest';
import fc from 'fast-check';
import { encodeComposition,decodeComposition } from './affinity-composition';
import { wireDecimal } from './wire-codec';

describe('bounded exact affinity compositions',()=>{
  it('preserves random legal vectors with their original zero and fractional values',()=>{
    fc.assert(fc.property(fc.integer({min:1,max:6}),fc.array(fc.integer({min:0,max:1000000}),{minLength:6,maxLength:6}),(parts,cuts)=>{
      const points=[0,...cuts.slice(0,parts-1).sort((a,b)=>a-b),1000000];
      const values=Array.from({length:parts},(_,i)=>(points[i+1]-points[i])/10000);
      const encoded=encodeComposition(values.map(wireDecimal));
      expect(decodeComposition(encoded.total,encoded.rank,parts)).toEqual(values);
    }),{numRuns:1500,seed:7318});
  });
  it('constructs bounded valid vectors from adversarial large ranks',()=>{
    fc.assert(fc.property(fc.integer({min:1,max:6}),fc.array(fc.integer({min:0,max:9}),{minLength:1,maxLength:100}),(parts,digits)=>{
      const rank=digits.join('').replace(/^0+(?=\d)/,'');const decoded=decodeComposition('100.000000',rank,parts);
      expect(decoded).toHaveLength(parts);expect(decoded.every(value=>Number.isFinite(value)&&value>=0&&value<=100)).toBe(true);
      expect(Math.abs(decoded.reduce((sum,value)=>sum+value,0)-100)).toBeLessThan(0.001);
      const canonical=encodeComposition(decoded.map(wireDecimal));expect(decodeComposition(canonical.total,canonical.rank,parts)).toEqual(decoded);
    }),{numRuns:300,seed:8118});
  });
  it('preserves subnormal and close-to-threshold accepted decimal totals',()=>{
    for(const values of [[5e-324,100],[0,0,12.5,37.5,25,25],[33.333,33.333,33.3339],[49.9999,50],[100-1e-10,0],[0.0001,99.999],[1.8704500595142597,40.77806573417725,2.9803995114346273,22.50153268468635,13.85524889208917,18.015303118098345]]){
      const encoded=encodeComposition(values.map(wireDecimal));expect(decodeComposition(encoded.total,encoded.rank,values.length)).toEqual(values);
    }
  });
  it('preserves canonical-left-fold-valid vectors near the tolerance boundary',()=>{
    let state=91,checked=0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    for(let index=0;index<300;index++){
      let remaining=index%2?99.99900000000001:100.00099999999999;const values:number[]=[];
      for(let part=0;part<5;part++){const value=remaining*random()/2;values.push(value);remaining-=value;}values.push(remaining);
      if(Math.abs(values.reduce((sum,value)=>sum+value,0)-100)>=0.001)continue;
      const encoded=encodeComposition(values.map(wireDecimal));expect(decodeComposition(encoded.total,encoded.rank,6)).toEqual(values);checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });
  it('rejects oversized, malformed and impossible inputs before arithmetic expansion',()=>{
    for(const [total,rank,parts] of [['100.'+'0'.repeat(331),'0',6],['100','9'.repeat(1701),6],['1e2','0',2],['100','-1',2],['100','00',2],['100','0',0],['100.0005','0',1],['100.'+'0'.repeat(100)+'1','0',1],['99','0',2]] as const)expect(()=>decodeComposition(total,rank,parts)).toThrow();
  });
  it('decodes ten thousand ordinary two-attribute records within a bounded budget',()=>{
    const encoded=encodeComposition(['70','30']);const start=performance.now();let sum=0;
    for(let i=0;i<10000;i++){const values=decodeComposition(encoded.total,encoded.rank,2);sum+=values[0]+values[1];}
    expect(sum).toBe(1000000);expect(performance.now()-start).toBeLessThan(5000);
  });
});
