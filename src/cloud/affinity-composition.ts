/** Lossless constructive encoding of a bounded percentage vector.
 * Decimal percentages become integer units at their common decimal precision.
 * A lexicographic rank chooses a composition of that exact total, with each
 * part in [0, 100 * scale]. Any nonnegative rank (modulo the number of choices)
 * therefore selects a mathematically bounded vector. The ordinary canonical
 * floating-point sum check still runs after conversion; malformed boundary
 * encodings fail closed instead of normalizing historical percentages.
 */
// Exact decimal totals and a canonical left-fold of ≤6 doubles can differ by
// a few ulps. This wire-only guard covers that representation roundoff; the
// canonical 0.001 tolerance remains enforced before encoding and after decode.
const WIRE_TOTAL_TOLERANCE=0.001+1e-12;
const invalid=()=>new Error('A synchronized percentage vector could not be read safely.');
function choose(n:bigint,k:number):bigint{
  if(k<0||n<BigInt(k))return 0n;
  let result=1n;for(let i=1;i<=k;i++)result=result*(n-BigInt(i-1))/BigInt(i);return result;
}
function binomial(n:number,k:number):bigint{return choose(BigInt(n),k);}
// Stars-and-bars with inclusion/exclusion removes parts above the cap.
function count(total:bigint,parts:number,cap:bigint):bigint{
  if(parts===0)return total===0n?1n:0n;
  let result=0n;
  for(let i=0;i<=parts;i++){const term=binomial(parts,i)*choose(total-BigInt(i)*(cap+1n)+BigInt(parts-1),parts-1);result+=i%2?-term:term;}
  return result;
}
/** Number of choices whose next component is below the supplied value.
 * The binomial difference is the hockey-stick identity summed across that
 * prefix, so neither ranking nor decoding iterates through the unit range. */
function before(total:bigint,remaining:number,cap:bigint,value:bigint):bigint{
  let result=0n;
  for(let i=0;i<=remaining;i++){
    const shifted=total-BigInt(i)*(cap+1n)+BigInt(remaining);
    const term=binomial(remaining,i)*(choose(shifted,remaining)-choose(shifted-value,remaining));
    result+=i%2?-term:term;
  }
  return result;
}
function decimal(units:bigint,precision:number):string{
  if(!precision)return String(units);
  const digits=String(units).padStart(precision+1,'0');return `${digits.slice(0,-precision)}.${digits.slice(-precision)}`;
}
function totalParts(text:string):{units:bigint;precision:number;cap:bigint}{
  if(!/^(?:99|100)(?:\.[0-9]{1,330})?$/.test(text)||Math.abs(Number(text)-100)>=WIRE_TOTAL_TOLERANCE)throw invalid();
  const [whole,fraction='']=text.split('.'),precision=fraction.length;
  return {units:BigInt(whole+fraction),precision,cap:100n*10n**BigInt(precision)};
}
export function encodeComposition(values:readonly string[]):{total:string;rank:string}{
  if(values.length<1||values.length>6||values.some(value=>!/^(?:0|[1-9][0-9]?|100)(?:\.[0-9]{1,330})?$/.test(value)||Number(value)>100))throw invalid();
  if(Math.abs(values.reduce((sum,value)=>sum+Number(value),0)-100)>=0.001)throw invalid();
  const precision=Math.max(...values.map(value=>value.split('.')[1]?.length||0));
  const units=values.map(value=>{const [whole,fraction='']=value.split('.');return BigInt(whole+fraction.padEnd(precision,'0'));});
  const cap=100n*10n**BigInt(precision),total=units.reduce((sum,value)=>sum+value,0n),text=decimal(total,precision);totalParts(text);
  let rank=0n,remaining=total;
  for(let index=0;index<units.length-1;index++){rank+=before(remaining,units.length-index-1,cap,units[index]);remaining-=units[index];}
  return {total:text,rank:String(rank)};
}
export function decodeComposition(total:string,rankText:string,parts:number):number[]{
  if(!Number.isInteger(parts)||parts<1||parts>6||!/^(?:0|[1-9][0-9]{0,1699})$/.test(rankText))throw invalid();
  const parsed=totalParts(total),choices=count(parsed.units,parts,parsed.cap);if(choices<=0n)throw invalid();
  let rank=BigInt(rankText)%choices,remaining=parsed.units;const result:bigint[]=[];
  for(let index=0;index<parts-1;index++){
    const rest=parts-index-1;let low=0n,high=remaining<parsed.cap?remaining:parsed.cap;
    while(low<high){const middle=(low+high+1n)/2n;if(before(remaining,rest,parsed.cap,middle)<=rank)low=middle;else high=middle-1n;}
    rank-=before(remaining,rest,parsed.cap,low);result.push(low);remaining-=low;
  }
  if(remaining<0n||remaining>parsed.cap)throw invalid();result.push(remaining);
  const decoded=result.map(value=>Number(decimal(value,parsed.precision)));
  if(Math.abs(decoded.reduce((sum,value)=>sum+value,0)-100)>=0.001)throw invalid();
  return decoded;
}
